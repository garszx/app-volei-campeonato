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

interface Partida {
  id: string;
  fase: string;
  horario: string;
  status: string;
  pontosA: number;
  pontosB: number;
  timeA: Time;
  timeB: Time;
}

export default function TabelaTorneio() {
  const [times, setTimes] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [statusTorneio, setStatusTorneio] = useState<string>('');

  useEffect(() => {
    const torneioRef = ref(db, 'torneio');
    const unsubscribe = onValue(torneioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStatusTorneio(data.config?.status || '');
        if (data.times) {
          setTimes(Object.values(data.times));
        }
        if (data.partidas) {
          // Extrai as partidas e aplica a ordenação pelo horário (ex: 07:30 vem antes de 08:00)
          const partidasArray = Object.values(data.partidas) as Partida[];
          partidasArray.sort((a, b) => a.horario.localeCompare(b.horario));
          setPartidas(partidasArray);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const gerarTabela = async () => {
    if (times.length !== 6) {
      alert("Aguarde o carregamento dos 6 times.");
      return;
    }

    const timesSorteados = [...times];
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
        timeA: {
          id: timesSorteados[confronto[0]].id,
          nome: timesSorteados[confronto[0]].nome,
          escudoUrl: timesSorteados[confronto[0]].escudoUrl
        },
        timeB: {
          id: timesSorteados[confronto[1]].id,
          nome: timesSorteados[confronto[1]].nome,
          escudoUrl: timesSorteados[confronto[1]].escudoUrl
        }
      };
    });

    await update(ref(db, 'torneio/config'), { status: 'fase_grupos' });
    await set(ref(db, 'torneio/partidas'), novasPartidas);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tabela de Jogos</h1>
        {statusTorneio === 'aguardando_sorteio' && (
          <button className={styles.btnGerar} onClick={gerarTabela}>
            Embaralhar Times e Gerar Tabela
          </button>
        )}
      </div>

      <div className={styles.listaJogos}>
        {partidas.map((jogo) => (
          <div key={jogo.id} className={styles.cardJogo}>
            <span className={styles.horario}>{jogo.horario}</span>
            
            <div className={styles.confronto}>
              <div className={styles.time}>
                <span>{jogo.timeA.nome}</span>
                <Image src={jogo.timeA.escudoUrl} alt="Escudo A" className={styles.escudo} width={40} height={40} />
              </div>
              <span className={styles.vs}>X</span>
              <div className={styles.time}>
                <Image src={jogo.timeB.escudoUrl} alt="Escudo B" className={styles.escudo} width={40} height={40} />
                <span>{jogo.timeB.nome}</span>
              </div>
            </div>

            <span className={styles.status}>
              {jogo.status === 'pendente' ? 'Aguardando' : jogo.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}