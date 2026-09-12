"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import styles from './ao-vivo.module.css';

interface Time {
  id: string;
  nome: string;
  escudoUrl: string;
}

interface Partida {
  id: string;
  horario: string;
  status: string;
  pontosA: number;
  pontosB: number;
  timeA: Time;
  timeB: Time;
}

export default function TelaoAoVivo() {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const torneioRef = ref(db, 'torneio/partidas');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const partidasArray = Object.values(data) as Partida[];
        partidasArray.sort((a, b) => a.horario.localeCompare(b.horario));
        setPartidas(partidasArray);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className={styles.container}><h2>Carregando telão...</h2></div>;
  }

  // Busca o jogo que o admin iniciou
  const jogoAtual = partidas.find(p => p.status === 'em_andamento');
  // Se não houver jogo rolando, busca o próximo da fila
  const proximoJogo = partidas.find(p => p.status === 'pendente');

  return (
    <div className={styles.container}>
      {jogoAtual ? (
        <>
          <h2 className={styles.title}>Partida em Andamento</h2>
          
          <div className={styles.placarAoVivo}>
            <div className={styles.timeCol}>
              <Image src={jogoAtual.timeA.escudoUrl} alt="Escudo A" className={styles.escudo} width={120} height={120} />
              <h3 className={styles.timeNome}>{jogoAtual.timeA.nome}</h3>
              <span className={styles.pontuacao}>{jogoAtual.pontosA}</span>
            </div>

            <div className={styles.vsCard}>
              <span className={styles.horarioBadge}>{jogoAtual.horario}</span>
              <span className={styles.vsText}>X</span>
            </div>

            <div className={styles.timeCol}>
              <Image src={jogoAtual.timeB.escudoUrl} alt="Escudo B" className={styles.escudo} width={120} height={120} />
              <h3 className={styles.timeNome}>{jogoAtual.timeB.nome}</h3>
              <span className={styles.pontuacao}>{jogoAtual.pontosB}</span>
            </div>
          </div>
        </>
      ) : proximoJogo ? (
        <div className={styles.mensagemEspera}>
          <h2 className={styles.title}>Próxima Partida - {proximoJogo.horario}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px', justifyContent: 'center', marginTop: '20px' }}>
             <Image src={proximoJogo.timeA.escudoUrl} alt="Escudo A" width={80} height={80} />
             <span className={styles.vsText}>X</span>
             <Image src={proximoJogo.timeB.escudoUrl} alt="Escudo B" width={80} height={80} />
          </div>
          <p style={{ marginTop: '20px', fontSize: '20px' }}>Aguardando o início pelo mesário...</p>
        </div>
      ) : (
        <div className={styles.mensagemEspera}>
          <h2>O torneio foi concluído!</h2>
        </div>
      )}
    </div>
  );
}