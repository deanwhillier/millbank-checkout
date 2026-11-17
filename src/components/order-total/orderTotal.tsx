import React from 'react';
import {Price} from '@boldcommerce/stacks-ui';
import {Constants} from 'src/constants';
import {getTerm} from 'src/utils';
import {useAppSelector, useGetCurrencyInformation, useGetSummaryTotal} from 'src/hooks';

export function OrderTotal(): React.ReactElement {
    const {finalTotal} = useGetSummaryTotal();
    const {formattedPrice} = useGetCurrencyInformation();
    const displayExchangeRate: number = useAppSelector((state) => state.data.application_state?.display_exchange_rate);
    const displayTotal = displayExchangeRate ? displayExchangeRate * finalTotal : finalTotal;
    const label = getTerm('order_total', Constants.SUMMARY_INFO, undefined, 'Order total');
    const taxesNote = getTerm('including_taxes', Constants.SUMMARY_INFO, undefined, '(Including taxes)');

    return (
        <div className={'order-total'} data-testid={'order-total'}>
            <div className={'order-total__label'}>
                <span className={'order-total__title'}>{label}</span>
                <span className={'order-total__note'}>{taxesNote}</span>
            </div>
            <Price
                className={'order-total__price'}
                moneyFormatString={formattedPrice}
                amount={displayTotal}
                textAlign={'right'}
                data-testid={'order-total-price'}
            />
        </div>
    );
}
