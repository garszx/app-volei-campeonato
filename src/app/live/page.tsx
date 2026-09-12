"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { db } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import styles from './live.module.css';

interface Time {
  id: string;
  nome: string;
  escudoUrl: string;
}

interface Partida {
  id: string;
  fase: string;
  horario: string;
  status: string;
  pontosA: number;
  pontosB: number;
  setsVencidosA?: number;
  setsVencidosB?: number;
  timeA: Time;
  timeB: Time;
}

interface Regras {
  formatoGrupos: string;
  formatoFinais: string;
}

export default function TelaoLive() {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const torneioRef = ref(db, 'torneio');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRegras(data.config?.regras || null);
        if (data.partidas) {
          const partidasArray = Object.values(data.partidas) as Partida[];
          partidasArray.sort((a, b) => a.horario.localeCompare(b.horario));
          setPartidas(partidasArray);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className={styles.container}><h2>Carregando telão...</h2></div>;
  }

  const jogoAtual = partidas.find(p => p.status === 'em_andamento');
  const proximoJogo = partidas.find(p => p.status === 'pendente');

  const isMelhorDe3 = jogoAtual ? (
    (jogoAtual.fase === 'grupos' && regras?.formatoGrupos === 'melhor_de_3') || 
    ((jogoAtual.fase === 'semifinal' || jogoAtual.fase === 'final' || jogoAtual.fase === 'terceiro_lugar') && regras?.formatoFinais === 'melhor_de_3')
  ) : false;

  return (
    <div className={styles.container}>
      {jogoAtual ? (
        <>
          <div className={styles.headerLive}>
            <span className={styles.liveBadge}>AO VIVO</span>
            <span className={styles.horarioBadge}>{jogoAtual.horario}</span>
          </div>

          {isMelhorDe3 && (
            <div className={styles.setsInfo}>
              Placar de Sets: <strong>{jogoAtual.setsVencidosA || 0}</strong> x <strong>{jogoAtual.setsVencidosB || 0}</strong>
            </div>
          )}
          
          <div className={styles.placarLive}>
            <div className={styles.timeCol}>
              <div className={styles.escudoWrapper}>
                <Image src={jogoAtual.timeA.escudoUrl} alt="Escudo A" className={styles.escudo} width={110} height={110} />
              </div>
              <h3 className={styles.timeNome}>{jogoAtual.timeA.nome}</h3>
              <span className={styles.pontuacao}>{jogoAtual.pontosA}</span>
            </div>

            <div className={styles.vsCard}>
              <span className={styles.vsText}>X</span>
            </div>

            <div className={styles.timeCol}>
              <div className={styles.escudoWrapper}>
                <Image src={jogoAtual.timeB.escudoUrl} alt="Escudo B" className={styles.escudo} width={110} height={110} />
              </div>
              <h3 className={styles.timeNome}>{jogoAtual.timeB.nome}</h3>
              <span className={styles.pontuacao}>{jogoAtual.pontosB}</span>
            </div>
          </div>
        </>
      ) : proximoJogo ? (
        <div className={styles.mensagemEspera}>
          <h2 style={{ color: '#38bdf8', marginBottom: '20px' }}>Próxima Partida - {proximoJogo.horario}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px', justifyContent: 'center', margin: '30px 0' }}>
             <div style={{ textAlign: 'center' }}>
               <Image src={proximoJogo.timeA.escudoUrl} alt="Escudo A" width={80} height={80} style={{ objectFit: 'contain' }} />
               <p style={{ fontWeight: 'bold', marginTop: '10px' }}>{proximoJogo.timeA.nome}</p>
             </div>
             <span className={styles.vsText}>X</span>
             <div style={{ textAlign: 'center' }}>
               <Image src={proximoJogo.timeB.escudoUrl} alt="Escudo B" width={80} height={80} style={{ objectFit: 'contain' }} />
               <p style={{ fontWeight: 'bold', marginTop: '10px' }}>{proximoJogo.timeB.nome}</p>
             </div>
          </div>
          <p style={{ fontSize: '18px', color: '#94a3b8' }}>Aguardando o início da partida pela mesa...</p>
        </div>
      ) : (
        <div className={styles.mensagemEspera}>
          <h2>O torneio foi concluído! 🏆</h2>
          <p style={{ fontSize: '18px', color: '#94a3b8', marginTop: '15px' }}>Confira a classificação final na central do torneio.</p>
        </div>
      )}
    </div>
  );
}