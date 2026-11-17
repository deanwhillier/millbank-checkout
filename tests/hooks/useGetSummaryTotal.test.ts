import {renderHook} from '@testing-library/react-hooks';
import {mocked} from 'jest-mock';
import {
    useGetDiscounts,
    useGetFees,
    useGetLineItems,
    useGetOrderTotal,
    useGetPayments,
    useGetSelectShippingLine,
    useGetSummaryTotal,
    useGetTaxes
} from 'src/hooks';
import {ILineItem, ITax} from '@boldcommerce/checkout-frontend-library';

jest.mock('src/hooks/useGetDiscounts');
jest.mock('src/hooks/useGetFees');
jest.mock('src/hooks/useGetLineItems');
jest.mock('src/hooks/useGetOrderTotal');
jest.mock('src/hooks/useGetPayments');
jest.mock('src/hooks/useGetSelectShippingLine');
jest.mock('src/hooks/useGetTaxes');
const useGetDiscountsMock = mocked(useGetDiscounts, true);
const useGetFeesMock = mocked(useGetFees, true);
const useGetLineItemsMock = mocked(useGetLineItems, true);
const useGetOrderTotalMock = mocked(useGetOrderTotal, true);
const useGetPaymentsMock = mocked(useGetPayments, true);
const useGetSelectShippingLineMock = mocked(useGetSelectShippingLine, true);
const useGetTaxesMock = mocked(useGetTaxes, true);

describe('Testing hook useGetSummaryTotal', () => {
    const lineItems = [{product_data: {quantity: 2, price: 1000}, fees: []}] as unknown as Array<ILineItem>;
    const shipping = {id: 'ship_1', description: 'Ground', amount: 500, code: ''};

    beforeEach(() => {
        jest.resetAllMocks();
        useGetDiscountsMock.mockReturnValue([]);
        useGetFeesMock.mockReturnValue([]);
        useGetPaymentsMock.mockReturnValue([]);
        useGetLineItemsMock.mockReturnValue(lineItems);
        useGetSelectShippingLineMock.mockReturnValue(shipping);
        useGetOrderTotalMock.mockReturnValue(3000);
    });

    test('taxes present: total is the order total, payments do not reduce it', () => {
        useGetTaxesMock.mockReturnValue([{value: 390}] as unknown as Array<ITax>);
        useGetPaymentsMock.mockReturnValue([{amount: 1000}] as never);
        const {result} = renderHook(() => useGetSummaryTotal());
        expect(result.current.taxesAreEstimated).toBe(false);
        expect(result.current.finalTaxes).toBe(390);
        expect(result.current.finalTotal).toBe(3000);
        expect(result.current.totals.totalSubtotal).toBe(2000);
    });

    test('no taxes: total is subtotal + shipping + 13% estimate, not the order total', () => {
        useGetTaxesMock.mockReturnValue([]);
        const {result} = renderHook(() => useGetSummaryTotal());
        // (2000 + 500) * 0.13 = 325
        expect(result.current.taxesAreEstimated).toBe(true);
        expect(result.current.finalTaxes).toBe(325);
        expect(result.current.finalTotal).toBe(2825);
        expect(result.current.shipping).toBe(shipping);
    });

    test('taxes summing to zero count as estimated', () => {
        useGetTaxesMock.mockReturnValue([{value: 0}] as unknown as Array<ITax>);
        const {result} = renderHook(() => useGetSummaryTotal());
        expect(result.current.taxesAreEstimated).toBe(true);
        expect(result.current.finalTotal).toBe(2825);
    });
});
