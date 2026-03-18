/**
 * 计算Gas费用价值
 *
 * 计算公式: gasLimit * gasPrice * ethUsdPrice
 * - gasLimit: 交易使用的gas数量
 * - gasPrice: Gas价格 (单位: Gwei)
 * - ethUsdPrice: ETH/USD价格
 */

export interface GasPriceInfo {
  gasLimit: number;
  gasPriceGwei: number;
  ethUsdPrice: number;
}

/**
 * 计算指定gas量价值多少USDT
 * @param gasLimit - Gas数量 (如 150000)
 * @param gasPriceGwei - Gas价格 (单位: Gwei)
 * @param ethUsdPrice - ETH/USD价格
 * @returns USDT价值
 */
export function calculateGasFeeUsdt(
  gasLimit: number,
  gasPriceGwei: number,
  ethUsdPrice: number
): number {
  // Gwei 转 ETH: 1 Gwei = 10^-9 ETH
  const gasPriceEth = gasPriceGwei * 1e-9;

  // 计算总费用 (ETH)
  const totalEth = BigInt(gasLimit) * BigInt(gasPriceGwei * 1e9);

  // 转换为USDT
  const usdtValue = Number(totalEth) * 1e-18 * ethUsdPrice;

  return usdtValue;
}

/**
 * 从API获取当前Gas价格和ETH价格，计算费用
 * @param gasLimit - Gas数量
 * @returns USDT价值
 */
// 环境配置
export interface ChainConfig {
  name: string;
  rpc: string;
  nativeToken: string; // 代币符号
  priceApi: string; // 价格API
  priceSymbol: string; // 价格API返回的symbol
}

export const CHAIN_CONFIGS: { [key: string]: ChainConfig } = {
  // BSC 主网
  bsc: {
    name: 'BSC',
    rpc: 'https://bsc-dataseed1.binance.org',
    nativeToken: 'BNB',
    priceApi: 'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT',
    priceSymbol: 'BNB'
  },
  // Base Sepolia 测试网
  baseSepolia: {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    nativeToken: 'ETH',
    priceApi: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    priceSymbol: 'ETH'
  },
  // Base 主网
  base: {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    nativeToken: 'ETH',
    priceApi: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    priceSymbol: 'ETH'
  }
};

/**
 * 从链上RPC获取Gas价格
 */
export async function getGasPriceFromRpc(rpcUrl: string): Promise<number> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      params: [],
      id: 1
    })
  });
  const data = await response.json() as { result: string };
  // Hex 转 Gwei
  const wei = parseInt(data.result, 16);
  return wei / 1e9;
}

/**
 * 从 Binance API 获取代币价格 (无 CORS 问题)
 */
export async function getTokenPriceFromBinance(priceApi: string): Promise<number> {
  const response = await fetch(priceApi);
  const data = await response.json() as { price: string };
  return parseFloat(data.price);
}

export async function calculateGasFeeUsdtFromApi(
  gasLimit: number,
  chain: string = 'bsc' // 默认 BSC，可选: bsc, baseSepolia, base
): Promise<number> {
  const config = CHAIN_CONFIGS[chain] || CHAIN_CONFIGS.bsc;

  // 从 Binance 获取代币价格
  const tokenUsdPrice = await getTokenPriceFromBinance(config.priceApi);

  // 从RPC获取Gas价格
  const gasPriceGwei = await getGasPriceFromRpc(config.rpc);

  console.log('=== API Response ===');
  console.log('Chain:', config.name);
  console.log('Token Price (Binance):', tokenUsdPrice);
  console.log('Gas Price (Gwei):', gasPriceGwei);
  console.log('===================');

  return calculateGasFeeUsdt(gasLimit, gasPriceGwei, tokenUsdPrice);
}

// 示例用法
if (require.main === module) {
  const gasLimit = 150000;
  // 从命令行或环境变量获取 chain: bsc, baseSepolia, base
  const chain = process.env.CHAIN || process.argv[2] || 'bsc';

  console.log(`\n=== Config ===`);
  console.log(`Chain: ${chain}`);
  console.log(`============\n`);

  calculateGasFeeUsdtFromApi(gasLimit, chain)
    .then(usdtValue => {
      console.log(`\n=== Result ===`);
      console.log(`Gas Limit: ${gasLimit}`);
      console.log(`USDT Value: $${usdtValue.toFixed(4)}`);
    })
    .catch(console.error);
}
