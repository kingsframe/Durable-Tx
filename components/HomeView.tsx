import styles from '../styles/Home.module.css'
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';

const destAddress = new PublicKey('EJ5BiUhi6ifQpZmYBupx839xF1YKvZmj6yq9At3PecEh')
const transferAmount = 0.1 * LAMPORTS_PER_SOL;


const HomeView = () => {
    const wallet = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState(0)

    const getUserSOLBalance =  async (publicKey: PublicKey, connection: Connection) => {
        try {
          const balanceInLamports = await connection.getBalance(
            publicKey,
            'confirmed'
          );
          setBalance(balanceInLamports / LAMPORTS_PER_SOL);
        } catch (e) {
          console.log(`error getting balance: `, e);
        }
    }

    const transfer = async (from: PublicKey | null, to: PublicKey, amount: number) => {
        if (!from) throw new WalletNotConnectedError();

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: from,
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
        console.log('balance after transfer: ', balance)
      }

    useEffect(()=>{
        if (wallet.publicKey){
            getUserSOLBalance(wallet.publicKey, connection);
        }
    },[wallet, connection])

    return (
        <main className={styles.main}>
            <h1 className={styles.title}>
                SOL Balance : {balance} 
            </h1>
            <button
                onClick={() => transfer(wallet.publicKey, destAddress, transferAmount)}
            >
                <span>Transfer</span>
            </button>
        </main>
    )
}

export default HomeView
