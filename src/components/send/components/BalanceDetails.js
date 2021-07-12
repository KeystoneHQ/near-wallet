import React, { useState } from 'react';

import classNames from '../../../utils/classNames';
import Accordion from '../../common/Accordion';
import AccordionTrigger from './AccordionTrigger';
import Breakdown from './css/Breakdown.css';
import Amount from './entry_types/Amount';

const prefixTXEntryTitledId = (key) => `sendV2.TXEntry.title.${key}`;

const BalanceDetails = ({ availableToSend, availableBalance, reservedForFees }) => {
    const [open, setOpen] = useState(false);
    
    return (
        <Breakdown className={classNames(['available-to-send-breakdown' , open ? 'open' : ''])}>
            <Amount
                translateIdTitle={prefixTXEntryTitledId('availableToSend')}
                amount={availableToSend}
            />
            <Accordion
                trigger='available-to-send-breakdown'
                className='breakdown'
            >
                <Amount
                    translateIdTitle={prefixTXEntryTitledId('availableBalance')}
                    amount={availableBalance}
                />
                <Amount
                    translateIdTitle={prefixTXEntryTitledId('reservedForFees')}
                    amount={reservedForFees}
                    translateIdInfoTooltip='profile.security.mostSecureDesc'
                />
            </Accordion>
            <AccordionTrigger
                id='available-to-send-breakdown'
                translateIdTitle='sendV2.accordionTriggerTitle.balanceDetails'
                open={open}
                onClick={() => setOpen(!open)}
            />
        </Breakdown>
    );
};

export default BalanceDetails;