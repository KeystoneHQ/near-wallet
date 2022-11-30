import React from 'react';
import { connect } from 'react-redux';

import { selectAccountSlice } from '../../../redux/slices/account';
import { selectStatusMainLoader } from '../../../redux/slices/status';

interface Props {
    accountId: string
}

export const SetupKeystone = ({ accountId }: Props) => {
    console.log('accountId', accountId);
    return (<div>Keystone</div>);
};

const mapStateToProps = (state, { match }) => ({
    ...selectAccountSlice(state),
    accountId: match.params.accountId,
    mainLoader: selectStatusMainLoader(state)
});

const SetupKeystoneWithRouter = connect(mapStateToProps)(SetupKeystone);

export default SetupKeystoneWithRouter;
