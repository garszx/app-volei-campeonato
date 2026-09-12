"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { db } from '../../firebase';
import { ref, onValue, set, update } from 'firebase/database';
import styles from './tabela.module.css';

interface Time {
  id: string;
  nome: string;
  escudoUrl: string;
}

interface TimeDb {
  id: string;
  nome: string;
  escudoUrl: string;
  sets_vencidos: number;
  total_pontos: number;
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

export default function HubTorneio() {
  const [abaAtiva, setAbaAtiva] = useState<'jogos' | 'classificacao'>('jogos');
  const [timesClassificacao, setTimesClassificacao] = useState<TimeDb[]>([]);
  const [timesBase, setTimesBase] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [statusTorneio, setStatusTorneio] = useState<string>('');

  useEffect(() => {
    const torneioRef = ref(db, 'torneio');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatusTorneio(data.config?.status || '');
        
        if (data.times) {
          setTimesBase(Object.values(data.times));
          
          const timesArray = Object.values(data.times) as TimeDb[];
          timesArray.sort((a, b) => {
            if (b.sets_vencidos !== a.sets_vencidos) return b.sets_vencidos - a.sets_vencidos;
            return b.total_pontos - a.total_pontos;
          });
          setTimesClassificacao(timesArray);
        }

        if (data.partidas) {
          const partidasArray = Object.values(data.partidas) as Partida[];
          partidasArray.sort((a, b) => {
            const numA = parseInt(a.id.split('_')[1]);
            const numB = parseInt(b.id.split('_')[1]);
            return numA - numB;
          });
          setPartidas(partidasArray);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const gerarTabela = async () => {
    if (timesBase.length !== 6) {
      alert("Aguarde o carregamento dos 6 times.");
      return;
    }

    const timesSorteados = [...timesBase];
    for (let i = timesSorteados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [timesSorteados[i], timesSorteados[j]] = [timesSorteados[j], timesSorteados[i]];
    }

    const grade = [
      [0, 5], [1, 4], [2, 3],
      [0, 4], [5, 3], [1, 2],
      [0, 3], [4, 2], [5, 1],
      [0, 2], [3, 1], [4, 5],
      [0, 1], [2, 5], [3, 4] 
    ];

    const novasPartidas: Record<string, Partida> = {};

    grade.forEach((confronto, index) => {
      const minutosTotais = 7 * 60 + 30 + (index * 30);
      const horas = Math.floor(minutosTotais / 60);
      const minutos = minutosTotais % 60;
      const horarioFormatado = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
      const idPartida = `jogo_${index + 1}`;

      novasPartidas[idPartida] = {
        id: idPartida,
        fase: 'grupos',
        horario: horarioFormatado,
        status: 'pendente',
        pontosA: 0,
        pontosB: 0,
        timeA: { id: timesSorteados[confronto[0]].id, nome: timesSorteados[confronto[0]].nome, escudoUrl: timesSorteados[confronto[0]].escudoUrl },
        timeB: { id: timesSorteados[confronto[1]].id, nome: timesSorteados[confronto[1]].nome, escudoUrl: timesSorteados[confronto[1]].escudoUrl }
      };
    });

    await update(ref(db, 'torneio/config'), { status: 'fase_grupos' });
    await set(ref(db, 'torneio/partidas'), novasPartidas);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Central do Campeonato</h1>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tabBtn} ${abaAtiva === 'jogos' ? styles.tabBtnActive : ''}`}
            onClick={() => setAbaAtiva('jogos')}
          >
            Tabela de Jogos
          </button>
          <button 
            className={`${styles.tabBtn} ${abaAtiva === 'classificacao' ? styles.tabBtnActive : ''}`}
            onClick={() => setAbaAtiva('classificacao')}
          >
            Classificação Geral
          </button>
        </div>

        {statusTorneio === 'aguardando_sorteio' && abaAtiva === 'jogos' && (
          <button className={styles.btnGerar} onClick={gerarTabela}>
            Embaralhar Times e Gerar Tabela
          </button>
        )}
      </div>

      {abaAtiva === 'jogos' ? (
        <div className={styles.listaJogos}>
          {partidas.map((jogo) => {
            const numeroDoJogo = jogo.id.split('_')[1];
            
            let classeStatus = styles.statusPendente;
            let textoStatus = 'Aguardando';
            if (jogo.status === 'em_andamento') { classeStatus = styles.statusAndamento; textoStatus = 'Ao Vivo'; }
            if (jogo.status === 'finalizado') { classeStatus = styles.statusFinalizado; textoStatus = 'Finalizado'; }

            return (
              <div key={jogo.id} className={styles.cardJogo}>
                <div className={styles.cardTop}>
                  <span className={styles.jogoNumero}>
                    {jogo.fase === 'final' ? '🏆 GRANDE FINAL' : 
                     jogo.fase === 'terceiro_lugar' ? '🥉 Disputa de 3º Lugar' : 
                     jogo.fase === 'semifinal' ? `Jogo ${numeroDoJogo} (Semifinal)` : 
                     `Jogo ${numeroDoJogo}`}
                  </span>
                  <span className={styles.horario}>{jogo.horario}</span>
                </div>
                
                <div className={styles.confronto}>
                  <div className={styles.time}>
                    <Image src={jogo.timeA.escudoUrl} alt="Escudo A" className={styles.escudo} width={50} height={50} />
                    <span>{jogo.timeA.nome}</span>
                  </div>
                  
                  <div className={styles.placarCentral}>
                    {(jogo.fase === 'final' || jogo.fase === 'terceiro_lugar') && jogo.status !== 'pendente' && (
                      <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>
                        Sets: {jogo.setsVencidosA || 0} - {jogo.setsVencidosB || 0}
                      </span>
                    )}
                    
                    <span className={styles.placarNumeros}>
                      {jogo.status === 'pendente' ? 'X' : `${jogo.pontosA} - ${jogo.pontosB}`}
                    </span>
                    <span className={`${styles.statusTag} ${classeStatus}`}>{textoStatus}</span>
                  </div>

                  <div className={styles.time}>
                    <Image src={jogo.timeB.escudoUrl} alt="Escudo B" className={styles.escudo} width={50} height={50} />
                    <span>{jogo.timeB.nome}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.tableClassificacao}>
            <thead>
              <tr>
                <th>Pos</th>
                <th style={{ textAlign: 'left' }}>Time</th>
                <th>Vitórias (Sets)</th>
                <th>Pontos Totais</th>
              </tr>
            </thead>
            <tbody>
              {timesClassificacao.map((time, index) => (
                <tr key={time.id}>
                  <td className={styles.rank}>{index + 1}º</td>
                  <td>
                    <div className={styles.teamCell}>
                      <Image src={time.escudoUrl} alt={time.nome} width={35} height={35} className={styles.escudo} />
                      {time.nome}
                    </div>
                  </td>
                  <td className={styles.vitorias}>{time.sets_vencidos}</td>
                  <td style={{ fontWeight: 'bold' }}>{time.total_pontos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}