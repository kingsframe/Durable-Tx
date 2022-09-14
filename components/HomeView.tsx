import styles from '../styles/Home.module.css'
import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { getUserSOLBalance, transfer } from '../utils/helpers';

const destAddress = new PublicKey('2oaH7AKTzzT2LrXKhAzqeXFPvSTpj2hrksXXGg5dSXFz')
const transferAmount = 0.1 * LAMPORTS_PER_SOL;


const HomeView = () => {
    const wallet = useWallet();
    const { connection } = useConnection();
    const [balance, setBalance] = useState(0)

    useEffect(()=>{
        if (wallet.publicKey){
            getUserSOLBalance(wallet.publicKey, connection).then(walletBalance => setBalance(walletBalance));
        }
    },[wallet, connection])

    return (
        <main className={styles.main}>
            <h1 className={styles.title}>
                SOL Balance : {balance} 
            </h1>
            <button
                onClick={() => transfer(wallet, connection, destAddress, transferAmount)}
            >
                <span>Transfer</span>
            </button>
        </main>
    )
}

export default HomeView
