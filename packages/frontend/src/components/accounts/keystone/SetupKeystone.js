import React, { useEffect, useRef, useState } from 'react';
import { Translate } from 'react-localize-redux';
import { connect, useSelector } from 'react-redux';

import { DISABLE_CREATE_ACCOUNT, RECAPTCHA_CHALLENGE_API_KEY } from '../../../config';
import { Mixpanel } from '../../../mixpanel/index';
import {
    addKeystoneAccessKey,
    refreshAccount,
    redirectToApp,
    redirectTo,
    checkIsNew,
    fundCreateAccountKeystone,
    getKeystonePublicKey
} from '../../../redux/actions/account';
import { showCustomAlert } from '../../../redux/actions/status';
import { selectAccountHas2fa, selectAccountSlice } from '../../../redux/slices/account';
import { createNewAccount } from '../../../redux/slices/account/createAccountThunks';
import { actions as linkdropActions } from '../../../redux/slices/linkdrop';
import { selectStatusMainLoader } from '../../../redux/slices/status';
import {setKeystoneHdPath} from '../../../utils/localStorage';
import parseFundingOptions from '../../../utils/parseFundingOptions';
import { setKeyMeta, ENABLE_IDENTITY_VERIFIED_ACCOUNT } from '../../../utils/wallet';
import FormButton from '../../common/FormButton';
import GlobalAlert from '../../common/GlobalAlert';
import Container from '../../common/styled/Container.css';
import { isRetryableRecaptchaError, Recaptcha } from '../../Recaptcha';
import KeystoneIcon from '../../svg/KeystoneIcon';
import {KEYSTONE_HD_PATH_PREFIX} from "../../../redux/slices/keystone";

// const { checkAndHideLedgerModal } = ledgerActions;
const { setLinkdropAmount } = linkdropActions;

// FIXME: Use `debug` npm package so we can keep some debug logging around but not spam the console everywhere
const ENABLE_DEBUG_LOGGING = false;
const debugLog = (...args) => ENABLE_DEBUG_LOGGING && console.log('SetupKeystone:', ...args);

const SetupKeystone = (props) => {
    const [showInstructions, setShowInstructions] = useState(false);
    const [connect, setConnect] = useState(null);
    const [isNewAccount, setIsNewAccount] = useState(null);
    // TODO: Custom recaptcha hook
    const [recaptchaToken, setRecaptchaToken] = useState(null);
    const [confirmedPath, setConfirmedPath] = useState(1);
    const keystoneHdPath = `${KEYSTONE_HD_PATH_PREFIX}${confirmedPath}'`;

    const recaptchaRef = useRef(null);
    const fundingOptions = parseFundingOptions(props.location.search);
    const shouldRenderRecaptcha = !fundingOptions && RECAPTCHA_CHALLENGE_API_KEY && isNewAccount && !ENABLE_IDENTITY_VERIFIED_ACCOUNT;

    const accountHas2fa = useSelector(selectAccountHas2fa);
    // disable the Continue button if a user has 2fa enabled, or we don't know yet if it's disabled/enabled
    const accountMightHave2fa = !isNewAccount && (accountHas2fa || accountHas2fa === undefined);

    useEffect(() => {
        const performNewAccountCheck = async () => {
            setIsNewAccount(await props.dispatch(checkIsNew(props.accountId)));
        };
        performNewAccountCheck();
    }, []);

    const openShowInstructions = () => {
        setShowInstructions(true);
        Mixpanel.track('SR-Keystone See instructions');
    };
    const closeShowInstructions = () => {
        setShowInstructions(false);
        Mixpanel.track('SR-Keystone Close instructions');
    };

    const handleClick = async () => {
        const {
            dispatch,
            accountId,
        } = props;

        setConnect(true);
        await Mixpanel.withTracking('SR-Keystone Connect keystone',
            async () => {
                if (isNewAccount) {
                    let publicKey;

                    try {
                        debugLog(DISABLE_CREATE_ACCOUNT, fundingOptions);
                        publicKey = await dispatch(getKeystonePublicKey(keystoneHdPath));
                        await setKeyMeta(publicKey, { type: 'keystone' });
                        Mixpanel.track('SR-Keystone Set key meta');

                        // Set path to localstorage
                        setKeystoneHdPath({ accountId, path: keystoneHdPath });

                        // COIN-OP VERIFY ACCOUNT
                        if (DISABLE_CREATE_ACCOUNT && ENABLE_IDENTITY_VERIFIED_ACCOUNT && !fundingOptions) {
                            await dispatch(fundCreateAccountKeystone(accountId, publicKey));
                            Mixpanel.track('SR-Keystone Fund create account keystone');
                            return;
                        }

                        // IMPLICIT ACCOUNT
                        if (DISABLE_CREATE_ACCOUNT && !fundingOptions && !recaptchaToken) {
                            await dispatch(fundCreateAccountKeystone(accountId, publicKey));
                            Mixpanel.track('SR-Keystone Fund create account keystone');
                            return;
                        }

                        await dispatch(createNewAccount({ accountId, fundingOptions, recoveryMethod: 'keystone', publicKey, recaptchaToken })).unwrap();
                        if (fundingOptions?.fundingAmount) {
                            setLinkdropAmount(fundingOptions.fundingAmount);
                        }
                        // dispatch(checkAndHideLedgerModal());
                        Mixpanel.track('SR-Keystone Create new account keystone');
                    } catch (err) {
                        if (isRetryableRecaptchaError(err)) {
                            Mixpanel.track('Funded account creation failed due to invalid / expired reCaptcha response from user');
                            recaptchaRef.current.reset();

                            dispatch(showCustomAlert({
                                success: false,
                                messageCodeHeader: 'error',
                                messageCode: 'walletErrorCodes.invalidRecaptchaCode',
                                errorMessage: err.message
                            }));
                        } else if (err.code === 'NotEnoughBalance') {
                            Mixpanel.track('SR-Keystone NotEnoughBalance creating funded account');
                            dispatch(fundCreateAccountKeystone(accountId, publicKey));
                        }  else {
                            recaptchaRef?.current?.reset();

                            dispatch(showCustomAlert({
                                errorMessage: err.message,
                                success: false,
                                messageCodeHeader: 'error',
                            }));
                        }

                        return;
                    }
                } else {
                    try {
                        setKeystoneHdPath({ accountId, path: keystoneHdPath });
                        await dispatch(addKeystoneAccessKey(keystoneHdPath));
                    } catch (error) {
                        // dispatch(checkAndHideLedgerModal());
                        throw error;
                    }
                    Mixpanel.track('SR-Keystone Add keystone access key');
                }
                await dispatch(refreshAccount());
                if (isNewAccount) {
                    Mixpanel.track('SR-Keystone Go to profile of new account');
                    await dispatch(redirectToApp('/'));
                } else {
                    // dispatch(checkAndHideLedgerModal());
                    Mixpanel.track('SR-Keystone Go to setup keystone success');
                    await dispatch(redirectTo('/setup-ledger-success'));
                }
            },
            (e) => {
                setConnect('fail');
                throw e;
            }
        );
    };

    return (
        <Container className='small-centered border keystone-theme'>
            {props.localAlert && !props.localAlert.success && (
                <GlobalAlert
                    globalAlert={{
                        messageCode: `errors.ledger.${props.localAlert.id}`
                    }}
                    closeIcon={false}
                />
            )}
            <h1><Translate id='setupKeystone.header' /></h1>
            <KeystoneIcon />
            <h2>
                <Translate id='setupKeystone.one' />
            </h2>
            {
                shouldRenderRecaptcha && (
                    <Recaptcha
                        ref={recaptchaRef}
                        onChange={(token) => {
                            debugLog('onChange from recaptcha - setting token in state', token);
                            setRecaptchaToken(token);
                        }}
                        onFundAccountCreation={handleClick}
                    />
                )
            }
            <FormButton
                onClick={handleClick}
                sending={connect && props.mainLoader}
                sendingString='button.connecting'
                disabled={(!recaptchaToken && shouldRenderRecaptcha) || isNewAccount === null || accountMightHave2fa}
            >
                <Translate id={`button.${connect !== 'fail' ? 'continue' : 'retry'}`} />
            </FormButton>
            <FormButton
                className='link gray'
                onClick={() => props.history.goBack()}
                trackingId='SR-Keystone Click cancel button'
            >
                <Translate id='button.cancel' />
            </FormButton>
        </Container>
    );
};

const mapStateToProps = (state, { match }) => ({
    ...selectAccountSlice(state),
    accountId: match.params.accountId,
    mainLoader: selectStatusMainLoader(state)
});

export const SetupKeystoneWithRouter = connect(mapStateToProps)(SetupKeystone);
