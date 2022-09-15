import { WalletNotConnectedError } from "@solana/wallet-adapter-base";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export const getUserSOLBalance =  async (publicKey: PublicKey, connection: Connection) => {
    try {
      const balanceInLamports = await connection.getBalance(
        publicKey,
        'confirmed'
      );
      return (balanceInLamports / LAMPORTS_PER_SOL);
    } catch (e) {
      throw(e);
    }
}

export const transfer = async (wallet: WalletContextState, connection: Connection, to: PublicKey, amount: number) => {
    if (!wallet.publicKey) throw new WalletNotConnectedError();

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: to,
        lamports: amount,
      })
    );

    const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight }
    } = await connection.getLatestBlockhashAndContext();

    const signature = await wallet.sendTransaction(transaction, connection, { minContextSlot });
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
    console.log("transaction confirmed")
  }