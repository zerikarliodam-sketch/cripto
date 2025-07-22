import sdk from '@api/fundingrates';

export interface SdkFundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
}

export async function fetchSdkFundingRates(): Promise<SdkFundingRate[]> {
  try {
    const { data } = await sdk.fundingRates();
    if (data.code === 200 && data.funding_rates) {
        return data.funding_rates;
    }
    return [];
  } catch (error) {
    console.error('Error fetching from fundingrates SDK:', error);
    return [];
  }
}
