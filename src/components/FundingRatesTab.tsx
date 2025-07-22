import {
  Box,
  Flex,
  Grid,
  Text,
  VStack,
  Button,
  ButtonGroup,
  useColorModeValue,
  Badge,
  Skeleton,
  HStack,
  Icon,
  Tooltip,
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  Divider,
  useBreakpointValue,
  Container,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown, 
  Clock,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface FundingRate {
  market_id: number;
  exchange: string;
  symbol: string;
  rate: number;
  scaled?: number;
}

type FundingPeriod = '8h' | '1d' | '7d' | '30d' | '180d' | '1y';

// Exchange configurations
const EXCHANGE_CONFIG = {
  binance: { name: 'Binance', color: '#F0B90B' },
  bybit: { name: 'Bybit', color: '#F7931A' },
  hyperliquid: { name: 'Hyperliquid', color: '#0066CC' },
  lighter: { name: 'Lighter', color: '#6366F1' },
  okx: { name: 'OKX', color: '#3396FF' },
};

const okxSymbols = [
 
  "AAVE-USDT-SWAP", "ADA-USDT-SWAP", "AI-USDT-SWAP", "APT-USDT-SWAP", "AVAX-USDT-SWAP",
  "BERA-USDT-SWAP", "BNB-USDT-SWAP", "BTC-USDT-SWAP", "CRV-USDT-SWAP", "DOGE-USDT-SWAP",
  "DOT-USDT-SWAP", "ENA-USDT-SWAP", "ETH-USDT-SWAP", "FARTCOIN-USDT-SWAP", "HYPE-USDT-SWAP",
  "IP-USDT-SWAP", "JUP-USDT-SWAP", "KAITO-USDT-SWAP", "LINK-USDT-SWAP", "LTC-USDT-SWAP",
  "MKR-USDT-SWAP", "NEAR-USDT-SWAP", "ONDO-USDT-SWAP", "PENDLE-USDT-SWAP", "POL-USDT-SWAP",
  "POPCAT-USDT-SWAP", "PUMP-USDT-SWAP", "S-USDT-SWAP", "SEI-USDT-SWAP", "SOL-USDT-SWAP",
  "SPX-USDT-SWAP", "SUI-USDT-SWAP", "SYRUP-USDT-SWAP", "TAO-USDT-SWAP", "TON-USDT-SWAP",
  "TRUMP-USDT-SWAP", "TRX-USDT-SWAP", "UNI-USDT-SWAP", "VIRTUAL-USDT-SWAP", "WIF-USDT-SWAP",
  "WLD-USDT-SWAP", "XRP-USDT-SWAP"
];

const okxAdditionalSymbols = [ "BONK-USDT-SWAP", "FLOKI-USDT-SWAP", "PEPE-USDT-SWAP", "SHIB-USDT-SWAP",];

const thousandSymbols = new Set(["BONK", "FLOKI", "PEPE", "SHIB"]);


const allOkxSymbols = [...okxSymbols, ...okxAdditionalSymbols];

const extractCoin = (instId: string) => {
  const parts = instId.split('-');
  const asset = parts[0];
  return thousandSymbols.has(asset) ? `1000${asset}` : asset;
};

export function FundingRatesTab() {
  const [rates, setRates] = useState<FundingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<FundingPeriod>('8h');
  const [showDelta, setShowDelta] = useState(false);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Responsive layout
  const isMobile = useBreakpointValue({ base: true, lg: false });

  // Color scheme - professional and minimal
  const bg = useColorModeValue('white', 'gray.900');
  const cardBg = useColorModeValue('gray.50', 'gray.800');
  const headerBg = useColorModeValue('gray.100', 'gray.700');

  const subtleBorderColor = useColorModeValue('gray.100', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.750');
  const textPrimary = useColorModeValue('gray.900', 'gray.100');
  const textSecondary = useColorModeValue('gray.600', 'gray.400');
  
  // Calculate next funding reset time (every 8 hours at 00:00, 08:00, 16:00 UTC)
  const getNextFundingResetTime = () => {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const nextResetHour = Math.floor(currentHour / 8) * 8 + 8;
    const nextReset = new Date(now);
    
    if (nextResetHour >= 24) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      nextReset.setUTCHours(0, 0, 0, 0);
    } else {
      nextReset.setUTCHours(nextResetHour, 0, 0, 0);
    }
    
    return nextReset;
  };

  const [nextFundingReset, setNextFundingReset] = useState(getNextFundingResetTime());

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNextFundingReset(getNextFundingResetTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format countdown timer
  const formatCountdown = (targetDate: Date) => {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      return "00:00:00";
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // fetch & poll
  const fetchData = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const allRates: FundingRate[] = [];

      // 1. Fetch ZKLighter funding rates
      try {
        const res = await fetch(
          'https://mainnet.zklighter.elliot.ai/api/v1/funding-rates',
          { signal, headers: { accept: 'application/json' } }
        );
        const json = await res.json();
        if (!res.ok || json.code !== 200) throw new Error('Bad response from ZKLighter');
        allRates.push(...json.funding_rates);
      } catch (e: any) {
        console.error('Error fetching ZKLighter data:', e);
        setError(e.message ?? 'Network error fetching ZKLighter data');
      }

      // 2. Fetch OKX funding rates
      const okxRates: FundingRate[] = [];
      for (const symbol of allOkxSymbols) {
        try {
          const okxResponse = await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${symbol}`);
          const okxData = await okxResponse.json();
          
          if (okxData.data && okxData.data.length > 0) {
            const rateData = okxData.data[0];
            okxRates.push({
              market_id: 0, // Placeholder, as OKX API doesn't provide this
              exchange: 'okx',
              symbol: extractCoin(rateData.instId),
              rate: parseFloat(rateData.fundingRate),
            });
          }
        } catch (error) {
          console.error(`Error fetching OKX data for ${symbol}:`, error);
        }
      }
      allRates.push(...okxRates);

      setRates(allRates);
      setLastUpdated(new Date());
      setError(null);
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    
    let id: NodeJS.Timeout;
    if (isAutoRefreshing) {
      id = setInterval(() => fetchData(), 5 * 60 * 1000);
    }
    
    return () => {
      controller.abort();
      if (id) clearInterval(id);
    };
  }, [isAutoRefreshing]);

  // scale rate to chosen period
  const scaledRates = useMemo(() => {
    const mult: Record<FundingPeriod, number> = {
      '8h': 1,
      '1d': 3,
      '7d': 21,
      '30d': 90,
      '180d': 540,
      '1y': 1095,
    };
    return rates.map((r) => ({
      ...r,
      scaled: r.rate * mult[period],
    }));
  }, [rates, period]);

  const EXCHANGES = ['binance', 'bybit', 'hyperliquid', 'lighter', 'okx'];

  // build pivoted data
  const pivoted = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    scaledRates.forEach((r) => {
      if (!map.has(r.symbol)) map.set(r.symbol, {});
      map.get(r.symbol)![r.exchange] = r.scaled;
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([symbol, cells]) => ({ symbol, cells }));
  }, [scaledRates]);

  // arbitrage opportunities
  const podium = useMemo(() => {
    const arbMap = new Map<string, { diff: number; long: string; short: string }>();
    pivoted.forEach(({ symbol, cells }) => {
      const entries = Object.entries(cells).filter(([, v]) => v !== undefined) as [string, number][];
      if (entries.length < 2) return;
      const min = entries.reduce((a, b) => (a[1] < b[1] ? a : b));
      const max = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
      arbMap.set(symbol, {
        diff: max[1] - min[1],
        long: min[0],
        short: max[0],
      });
    });

    return [...arbMap.entries()]
      .sort(([, a], [, b]) => b.diff - a.diff)
      .slice(0, 10)
      .map(([symbol, data], i) => ({
        symbol,
        ...data,
        rank: i + 1,
      }));
  }, [pivoted]);

  // delta-neutral opportunities
  const deltaPodium = useMemo(() => {
    const map = new Map<string, { carry: number; longSpot: string; shortPerp: string }>();
    pivoted.forEach(({ symbol, cells }) => {
      const perpEntries = Object.entries(cells).filter(([, v]) => v !== undefined) as [string, number][];
      if (perpEntries.length < 1) return;

      // Find the venue with the highest funding rate to short
      const [shortPerp, shortRate] = perpEntries.reduce((a, b) => (a[1] > b[1] ? a : b));
      
      // Only consider positive carry trades
      if (shortRate <= 0) return;

      const longSpot = 'Spot';
      const carry = shortRate;
      map.set(symbol, { carry, longSpot, shortPerp });
    });

    return [...map.entries()]
      .sort(([, a], [, b]) => b.carry - a.carry)
      .slice(0, 10)
      .map(([symbol, data], i) => ({ symbol, ...data, rank: i + 1 }));
  }, [pivoted]);

  const sorted = useMemo(() => {
    let data = pivoted;
    if (selectedSymbol) {
      data = data.filter(item => item.symbol === selectedSymbol);
    }
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const av = a.cells[sort.col] ?? -Infinity;
      const bv = b.cells[sort.col] ?? -Infinity;
      return (av - bv) * sort.dir;
    });
  }, [pivoted, sort, selectedSymbol]);

  // Calculate market stats
  const marketStats = useMemo(() => {
    const allRates = scaledRates.map(r => r.scaled);
    const positiveRates = allRates.filter(r => r > 0);
    const negativeRates = allRates.filter(r => r < 0);
    
    return {
      totalMarkets: pivoted.length,
      avgRate: allRates.reduce((a, b) => a + b, 0) / allRates.length,
      maxArb: podium[0]?.diff || 0,
      bullishMarkets: positiveRates.length,
      bearishMarkets: negativeRates.length,
    };
  }, [scaledRates, pivoted, podium]);

  const getRateColor = (rate: number) => {
    const abs = Math.abs(rate * 100);
    if (rate > 0) return abs >= 0.1 ? 'red.500' : abs >= 0.05 ? 'red.400' : 'red.300';
    return abs >= 0.1 ? 'green.500' : abs >= 0.05 ? 'green.400' : 'green.300';
  };

  const getRankBadge = (rank: number) => {
    const colors: { [key: number]: string } = { 1: 'purple', 2: 'blue', 3: 'cyan' };
    const colorScheme = rank <= 3 ? colors[rank] : 'gray';
    return (
      <Badge
        colorScheme={colorScheme}
        variant="subtle"
        fontSize="xs"
        px={2}
        borderRadius="full"
      >
        #{rank}
      </Badge>
    );
  };

  if (error)
    return (
      <Container maxW="7xl" py={8}>
  
      </Container>
    );

  if (loading && !rates.length)
    return (
      <Container maxW="7xl" py={8}>
        <VStack spacing={6} align="stretch">
          <HStack spacing={4}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} h="100px" flex={1} borderRadius="md" />
            ))}
          </HStack>
          <Skeleton h="400px" borderRadius="md" />
        </VStack>
      </Container>
    );

  return (
    <Container maxW="7xl" py={8}>
      <VStack spacing={8} align="stretch">
        
        {/* Header */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <VStack align="flex-start" spacing={1}>
            <Text color={textSecondary} fontSize="sm">
              Cross-exchange arbitrage opportunities and funding rate analysis
            </Text>
          </VStack>
          
          <HStack spacing={2} fontSize="xs" color={textSecondary}>
            <Icon as={Clock} boxSize={4} />
            <Text>Last updated: {lastUpdated.toLocaleTimeString()}</Text>
            <Badge colorScheme="green" variant="subtle">LIVE</Badge>
            <Tooltip label={`Next funding reset at ${nextFundingReset.toUTCString()}`}>
              <HStack spacing={1}>
                <Text>Next reset:</Text>
                <Text fontWeight="600">{formatCountdown(nextFundingReset)}</Text>
              </HStack>
            </Tooltip>
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<Icon as={RefreshCw} boxSize={3} />}
              onClick={() => fetchData()}
              isLoading={loading}
            >
              Refresh
            </Button>
            <Button
              size="xs"
              variant={isAutoRefreshing ? 'solid' : 'outline'}
              colorScheme={isAutoRefreshing ? 'blue' : 'gray'}
              onClick={() => setIsAutoRefreshing(!isAutoRefreshing)}
            >
              Auto
            </Button>
          </HStack>
        </Flex>

        {/* Market Overview */}
        <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={3}>
          <Card bg={cardBg} variant="outline">
            <CardBody p={3}>
              <Stat>
                <StatLabel color={textSecondary} fontSize="2xs" fontWeight="500">
                  Active Markets
                </StatLabel>
                <StatNumber color={textPrimary} fontSize="lg" fontWeight="600">
                  {marketStats.totalMarkets}
                </StatNumber>
              </Stat>
            </CardBody>
          </Card>
          
          <Card bg={cardBg} variant="outline">
            <CardBody p={3}>
              <Stat>
                <StatLabel color={textSecondary} fontSize="2xs" fontWeight="500">
                  Average Rate
                </StatLabel>
                <StatNumber 
                  fontSize="lg" 
                  fontWeight="600" 
                  color={getRateColor(marketStats.avgRate)}
                >
                  {marketStats.avgRate >= 0 ? '+' : ''}{(marketStats.avgRate * 100).toFixed(3)}%
                </StatNumber>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} variant="outline">
            <CardBody p={3}>
              <Stat>
                <StatLabel color={textSecondary} fontSize="2xs" fontWeight="500">
                  Max Spread
                </StatLabel>
                <StatNumber fontSize="lg" fontWeight="600" color="green.500">
                  {(marketStats.maxArb * 100).toFixed(3)}%
                </StatNumber>
              </Stat>
            </CardBody>
          </Card>

          <Card bg={cardBg} variant="outline">
            <CardBody p={3}>
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="2xs" color={textSecondary} fontWeight="500">
                  Market Sentiment
                </Text>
                <HStack spacing={3}>
                  <VStack spacing={0}>
                    <HStack spacing={1}>
                      <Icon as={TrendingUp} color="red.500" boxSize={3} />
                      <Text fontSize="xs" fontWeight="600" color="red.500">
                        {marketStats.bullishMarkets}
                      </Text>
                    </HStack>
                    <Text fontSize="2xs" color={textSecondary}>Long Pay</Text>
                  </VStack>
                  <VStack spacing={0}>
                    <HStack spacing={1}>
                      <Icon as={TrendingDown} color="green.500" boxSize={3} />
                      <Text fontSize="xs" fontWeight="600" color="green.500">
                        {marketStats.bearishMarkets}
                      </Text>
                    </HStack>
                    <Text fontSize="2xs" color={textSecondary}>Short Pay</Text>
                  </VStack>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        </Grid>

        {/* Top Opportunities */}
        {podium.length > 0 && (
          <Card bg={cardBg} variant="outline" borderWidth="2px" borderColor={useColorModeValue('gray.400', 'gray.600')}>
            <CardBody>
              <VStack spacing={4}>
                <HStack justify="space-between" w="full">
                  <HStack>
                    
                    <Text fontSize="md" fontWeight="600" color={textPrimary}>
                      Top Arbitrage Opportunities
                    </Text>
                  </HStack>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Icon as={ArrowUpDown} boxSize={4} />}
                    onClick={() => setShowDelta(!showDelta)}
                  >
                    {showDelta ? 'Funding Arbitrage' : 'Delta-Neutral Carry'}
                  </Button>
                </HStack>

                <Box overflowX="auto" w="full" pb={4}>
                  <HStack spacing={4} w="max-content">
                    {(showDelta ? deltaPodium : podium).map((opp) => (
                      <Card 
                        key={opp.symbol} 
                        bg={bg} 
                        variant="outline" 
                        minW="240px" 
                        flexShrink={0}
                        transition="all 0.2s ease-in-out"
                        _hover={{ borderColor: 'blue.500', shadow: 'md' }}
                        onClick={() => setSelectedSymbol(opp.symbol)}
                        cursor="pointer"
                      >
                        <CardBody>
                          <VStack spacing={3}>
                            <HStack justify="space-between" w="full">
                              <Text fontWeight="600" fontSize="lg" color={textPrimary}>
                                {opp.symbol}
                              </Text>
                              {getRankBadge(opp.rank)}
                            </HStack>
                            
                            {showDelta ? (
                              <>
                                <Text fontSize="xl" fontWeight="700" color="green.500">
                                  +{((opp as any).carry * 100).toFixed(3)}%
                                </Text>
                                <VStack spacing={1} align="flex-start">
                                <HStack>
                                  <Icon as={TrendingUp} color="green.500" boxSize={3} />
                                  <Text fontSize="xs" color={textSecondary}>
                                    Buy Spot
                                  </Text>
                                </HStack>
                                <HStack>
                                  <Icon as={TrendingDown} color="red.500" boxSize={3} />
                                  <Text fontSize="xs" color={textSecondary}>
                                    Short {EXCHANGE_CONFIG[(opp as any).shortPerp as keyof typeof EXCHANGE_CONFIG]?.name || (opp as any).shortPerp}
                                  </Text>
                                </HStack>
                              </VStack>
                              </>
                            ) : (
                              <>
                                <Text fontSize="xl" fontWeight="700" color="green.500">
                                  +{((opp as any).diff * 100).toFixed(3)}%
                                </Text>
                                <VStack spacing={1} align="flex-start">
                                  <HStack>
                                    <Icon as={TrendingUp} color="green.500" boxSize={3} />
                                    <Text fontSize="xs" color={textSecondary}>
                                      Long {EXCHANGE_CONFIG[(opp as any).long as keyof typeof EXCHANGE_CONFIG]?.name || (opp as any).long}
                                    </Text>
                                  </HStack>
                                  <HStack>
                                    <Icon as={TrendingDown} color="red.500" boxSize={3} />
                                    <Text fontSize="xs" color={textSecondary}>
                                      Short {EXCHANGE_CONFIG[(opp as any).short as keyof typeof EXCHANGE_CONFIG]?.name || (opp as any).short}
                                    </Text>
                                  </HStack>
                                </VStack>
                              </>
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </HStack>
                </Box>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Period Selection */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <Text fontSize="lg" fontWeight="600" color={textPrimary}>
            Funding Rates
          </Text>
          {selectedSymbol && (
            <Button size="sm" variant="outline" onClick={() => setSelectedSymbol(null)}>
              Clear Filter ({selectedSymbol})
            </Button>
          )}
          <ButtonGroup size="sm" variant="outline" isAttached>
            {(['8h', '1d', '7d', '30d', '180d', '1y'] as FundingPeriod[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'solid' : 'outline'}
                colorScheme={period === p ? 'blue' : 'gray'}
                onClick={() => setPeriod(p)}
                fontWeight="500"
              >
                {p}
              </Button>
            ))}
          </ButtonGroup>
        </Flex>


        {/* Funding Rates Table */}
<Card bg={cardBg} variant="outline" overflow="hidden">
  <CardBody p={0}>
    {/* Table Header - Sticky */}
    <Grid
      templateColumns={isMobile ? "1.5fr repeat(2, 1fr)" : "1.5fr repeat(4, 1fr)"}
      px={4}
      py={2}
      bg={headerBg}
      position="sticky"
      top={0}
      zIndex={2}
      boxShadow="sm"
    >
      <Text 
        fontSize="xs" 
        fontWeight="600" 
        color={textPrimary}
        pl={2}
      >
        Asset
      </Text>
      {(isMobile ? ['binance', 'bybit'] : EXCHANGES).map((ex) => (
        <Flex 
          key={ex}
          align="center" 
          justify="flex-end"
          pr={2}
          cursor="pointer"
          onClick={() =>
            setSort(
              sort?.col === ex
                ? { col: ex, dir: (-sort.dir as 1 | -1) }
                : { col: ex, dir: 1 }
            )
          }
          _hover={{ color: 'blue.500' }}
        >
          <Text
            fontSize="xs"
            fontWeight="600"
            color={sort?.col === ex ? 'blue.500' : textPrimary}
            textAlign="right"
          >
            {EXCHANGE_CONFIG[ex as keyof typeof EXCHANGE_CONFIG]?.name || ex}
          </Text>
          {sort?.col === ex && (
            <Icon 
              as={sort.dir === 1 ? ArrowUp : ArrowDown} 
              boxSize={3} 
              ml={1}
              color="blue.500"
            />
          )}
        </Flex>
      ))}
    </Grid>

    {/* Table Body with fixed height and scroll */}
    <Box maxH="500px" overflowY="auto">
      {sorted.map(({ symbol, cells }) => (
        <Grid
          key={symbol}
          templateColumns={isMobile ? "1.5fr repeat(2, 1fr)" : "1.5fr repeat(4, 1fr)"}
          px={4}
          py={2}
          alignItems="center"
          borderBottom="1px solid"
          borderColor={subtleBorderColor}
          _hover={{ bg: hoverBg }}
          transition="background-color 0.1s ease"
         
        >
          <Text
            fontSize="xs"
            fontWeight="500"
            color={textPrimary}
            pl={2}
            isTruncated
          >
            {symbol}
          </Text>

          {(isMobile ? ['binance', 'bybit'] : EXCHANGES).map((ex) => {
            const rate = cells[ex];
         
            
            return (
              <Flex 
                key={ex} 
                align="center" 
                justify="flex-end"
                pr={2}
              >
                {rate === undefined ? (
                  <Text fontSize="xs" color={textSecondary}>—</Text>
                ) : (
                  <HStack spacing={1}>
                    <Box 
                      w="6px" 
                      h="6px" 
                      borderRadius="full" 
                     
                    />
                    <Text
                      fontSize="xs"
                      fontWeight="medium"
                      fontFamily="monospace"
                      color={getRateColor(rate)}
                    >
                      {(rate * 100).toFixed(3)}%
                    </Text>
                  </HStack>
                )}
              </Flex>
            );
          })}
        </Grid>
      ))}
    </Box>
  </CardBody>
</Card>

        {/* Footer */}
        <Divider />
        <HStack justify="center" spacing={8} color={textSecondary} fontSize="xs">
          <Text>Positive rates: Long pays Short funding</Text>
          <Text>Negative rates: Short pays Long funding</Text>
          <Text>Rates annualized for selected period</Text>
        </HStack>
      </VStack>
    </Container>
  );
}