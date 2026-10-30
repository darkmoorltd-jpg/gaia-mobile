import Wallet from '../wallet';

// The agent wallet IS the farmer wallet.
// They share the same virtual account number, balance, and transaction history.
export default function AgentWallet() {
  return <Wallet />;
}
