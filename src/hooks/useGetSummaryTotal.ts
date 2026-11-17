import {getTotals} from 'src/utils';
import {
    useGetDiscounts,
    useGetFees,
    useGetLineItems,
    useGetOrderTotal,
    useGetPayments,
    useGetSelectShippingLine,
    useGetTaxes,
} from 'src/hooks';
import {IUseGetSummaryTotal} from 'src/types';

// Single source for the figure the summary "Total" line shows, so every place that displays it agrees.
export function useGetSummaryTotal(): IUseGetSummaryTotal {
    const discounts = useGetDiscounts();
    const fees = useGetFees();
    const payments = useGetPayments();
    const taxes = useGetTaxes();
    const shipping = useGetSelectShippingLine();
    const lineItems = useGetLineItems();
    const orderTotal = useGetOrderTotal();
    const totals = getTotals(lineItems, payments, taxes, fees, discounts, orderTotal);

    const estimatedTax = Math.round((totals.totalSubtotal + shipping.amount) * 0.13 * 100) / 100; // assume Ontario tax rate for estimation
    const taxesAreEstimated = totals.totalTaxes === 0;
    const finalTaxes = !taxesAreEstimated ? totals.totalTaxes : estimatedTax;
    const finalTotal = taxesAreEstimated ? totals.totalSubtotal + shipping.amount + estimatedTax : totals.totalOrder;

    return {totals, shipping, taxesAreEstimated, finalTaxes, finalTotal};
}
