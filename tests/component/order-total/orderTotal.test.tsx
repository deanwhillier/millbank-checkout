import {render} from '@testing-library/react';
import {mocked} from 'jest-mock';
import {OrderTotal} from 'src/components';
import {useAppSelector, useGetCurrencyInformation, useGetSummaryTotal} from 'src/hooks';
import {getTerm} from 'src/utils';

jest.mock('src/hooks/useGetSummaryTotal');
jest.mock('src/hooks/useGetCurrencyInformation');
jest.mock('src/hooks/rootHooks');
jest.mock('src/utils/getTerm');
const useGetSummaryTotalMock = mocked(useGetSummaryTotal, true);
const useGetCurrencyInformationMock = mocked(useGetCurrencyInformation, true);
const useAppSelectorMock = mocked(useAppSelector, true);
const getTermMock = mocked(getTerm, true);

describe('Testing OrderTotal component', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        getTermMock.mockImplementation((term, section, blob, defaultTerm) => defaultTerm ?? term);
        useGetCurrencyInformationMock.mockReturnValue({currency: 'USD', currencySymbol: '$', formattedPrice: '${{amount}}'});
        useAppSelectorMock.mockImplementation((selector) => selector({data: {application_state: {display_exchange_rate: undefined}}} as never));
    });

    const mockTotal = (finalTotal: number) => useGetSummaryTotalMock.mockReturnValue({
        totals: {} as never, shipping: {} as never, taxesAreEstimated: false, finalTaxes: 0, finalTotal
    });

    test('renders label, taxes note and the summary total', () => {
        mockTotal(62595);
        const {getByTestId, container} = render(<OrderTotal/>);
        expect(container.getElementsByClassName('order-total__title')[0].textContent).toBe('Order total');
        expect(container.getElementsByClassName('order-total__note')[0].textContent).toBe('(Including taxes)');
        expect(getByTestId('order-total-price').textContent).toContain('625.95');
    });

    test('applies the display exchange rate like the summary lines', () => {
        mockTotal(10000);
        useAppSelectorMock.mockImplementation((selector) => selector({data: {application_state: {display_exchange_rate: 1.5}}} as never));
        const {getByTestId} = render(<OrderTotal/>);
        expect(getByTestId('order-total-price').textContent).toContain('150.00');
    });

    test('renders from first paint with a zero total', () => {
        mockTotal(0);
        const {getByTestId} = render(<OrderTotal/>);
        expect(getByTestId('order-total')).toBeTruthy();
        expect(getByTestId('order-total-price').textContent).toContain('0.00');
    });
});
