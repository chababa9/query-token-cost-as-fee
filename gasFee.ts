/**
 * 计算Gas费用价值
 *
 * 计算公式: gasLimit * gasPrice * nativeTokenPrice
 * - gasLimit: 交易使用的gas数量
 * - gasPrice: Gas价格 (单位: Gwei)
 * - nativeTokenPrice: 原生代币价格 (以目标ERC20计价)
 */

export interface GasPriceInfo {
  gasLimit: number;
  gasPriceGwei: number;
  ethUsdPrice: number;
}

/**
 * 从链上获取ERC20代币的decimals
 * @param rpcUrl - RPC地址
 * @param tokenAddress - ERC20代币合约地址
 * @returns decimals
 */
export async function getTokenDecimals(rpcUrl: string, tokenAddress: string): Promise<number> {
  // ERC20 decimals() 函数选择器: 0x313ce567
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [
        {
          to: tokenAddress,
          data: '0x313ce567'
        },
        'latest'
      ],
      id: 1
    })
  });
  const data = await response.json() as { result: string };
  return parseInt(data.result, 16);
}

/**
 * 计算指定gas量价值多少ERC20代币
 * @param gasLimit - Gas数量 (如 150000)
 * @param gasPriceGwei - Gas价格 (单位: Gwei)
 * @param nativeTokenPrice - 原生代币价格 (以目标ERC20计价)
 * @param tokenDecimals - 目标ERC20代币精度 (如 USDT=6, DAI=18)
 * @returns 代币价值 (人类可读格式)
 */
export function calculateGasFeeInToken(
  gasLimit: number,
  gasPriceGwei: number,
  nativeTokenPrice: number,
  tokenDecimals: number
): number {
  // 计算总费用 (Wei)
  const totalWei = BigInt(gasLimit) * BigInt(gasPriceGwei * 1e9);

  // Wei -> 原生代币 (÷10^18, 因为原生代币始终是18位精度)
  // 原生代币 -> 目标ERC20代币价值
  const tokenValue = Number(totalWei) * 1e-18 * nativeTokenPrice;

  return tokenValue;
}

// 环境配置
export interface ChainConfig {
  name: string;
  rpc: string;
  nativeToken: string; // 原生代币符号
  priceApi: string; // 价格API
  priceSymbol: string; // 价格API返回的symbol
  feeTokenAddress: string; // 费用代币合约地址 (ERC20)
}

export const CHAIN_CONFIGS: { [key: string]: ChainConfig } = {
  // BSC 主网
  bsc: {
    name: 'BSC',
    rpc: 'https://bsc-dataseed1.binance.org',
    nativeToken: 'BNB',
    priceApi: 'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT',
    priceSymbol: 'BNB',
    feeTokenAddress: '0x55d398326f99059fF775485246999027B3197955' // BSC USDT
  },
  // Base Sepolia 测试网
  baseSepolia: {
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    nativeToken: 'ETH',
    priceApi: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    priceSymbol: 'ETH',
    feeTokenAddress: '0x' // 测试网无标准USDT，需替换
  },
  // Base 主网
  base: {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    nativeToken: 'ETH',
    priceApi: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
    priceSymbol: 'ETH',
    feeTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' // Base USDC
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

/**
 * 从API获取当前Gas价格和代币价格，计算费用
 * @param gasLimit - Gas数量
 * @param chain - 链名称
 * @param tokenAddress - 可选，自定义ERC20代币地址（覆盖链默认配置）
 * @returns ERC20代币价值
 */
export async function calculateGasFeeFromApi(
  gasLimit: number,
  chain: string = 'bsc',
  tokenAddress?: string
): Promise<number> {
  const config = CHAIN_CONFIGS[chain] || CHAIN_CONFIGS.bsc;
  const feeTokenAddr = tokenAddress || config.feeTokenAddress;

  // 并行获取: 代币价格、Gas价格、代币精度
  const [tokenUsdPrice, gasPriceGwei, decimals] = await Promise.all([
    getTokenPriceFromBinance(config.priceApi),
    getGasPriceFromRpc(config.rpc),
    getTokenDecimals(config.rpc, feeTokenAddr)
  ]);

  console.log('=== API Response ===');
  console.log('Chain:', config.name);
  console.log('Token Price (Binance):', tokenUsdPrice);
  console.log('Gas Price (Gwei):', gasPriceGwei);
  console.log('Fee Token Address:', feeTokenAddr);
  console.log('Fee Token Decimals:', decimals);
  console.log('===================');

  return calculateGasFeeInToken(gasLimit, gasPriceGwei, tokenUsdPrice, decimals);
}

// 示例用法
if (require.main === module) {
  const gasLimit = 150000;
  // 从命令行或环境变量获取 chain: bsc, baseSepolia, base
  const chain = process.env.CHAIN || process.argv[2] || 'bsc';
  // 可选：自定义代币地址
  const tokenAddress = process.env.TOKEN_ADDRESS || process.argv[3];

  console.log(`\n=== Config ===`);
  console.log(`Chain: ${chain}`);
  if (tokenAddress) console.log(`Token Address: ${tokenAddress}`);
  console.log(`============\n`);

  calculateGasFeeFromApi(gasLimit, chain, tokenAddress)
    .then(tokenValue => {
      console.log(`\n=== Result ===`);
      console.log(`Gas Limit: ${gasLimit}`);
      console.log(`Token Value: ${tokenValue.toFixed(6)}`);
    })
    .catch(console.error);
}
