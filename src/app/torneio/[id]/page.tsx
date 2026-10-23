"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './tabela.module.css';

import { useTorneio } from '../../../hooks/useTorneio';

import TabelaJogos from '../../../components/torneio/TabelaJogos';
import Classificacao from '../../../components/torneio/Classificacao';
import TelaoLive from '../../../components/torneio/TelaoLive';
import PainelMesa from '../../../components/torneio/PainelMesa';

export default function HubTorneio() {
  const params = useParams();
  const torneioId = params.id as string;
  
  const [abaAtiva, setAbaAtiva] = useState<'jogos' | 'classificacao' | 'live' | 'admin'>('jogos');

  const torneio = useTorneio(torneioId);

  const trocarAba = (novaAba: 'jogos' | 'classificacao' | 'live' | 'admin') => {
    setAbaAtiva(novaAba);
    torneio.setPartidaEditando(null);
    torneio.setMostrarEditorEquipes(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{torneio.regras?.nomeCampeonato || 'Carregando...'}</h1>
        <div className={`${styles.tabs} no-print`}>
          <button className={`${styles.tabBtn} ${abaAtiva === 'jogos' ? styles.tabBtnActive : ''}`} onClick={() => trocarAba('jogos')}>Tabela de Jogos</button>
          <button className={`${styles.tabBtn} ${abaAtiva === 'classificacao' ? styles.tabBtnActive : ''}`} onClick={() => trocarAba('classificacao')}>Classificação</button>
          <button className={`${styles.tabBtn} ${abaAtiva === 'live' ? styles.tabBtnActive : ''}`} onClick={() => trocarAba('live')}>Telão Ao Vivo</button>
          <button className={`${styles.tabBtn} ${abaAtiva === 'admin' ? styles.tabBtnAdminActive : ''}`} onClick={() => trocarAba('admin')}>⚙️ Mesa {torneio.nivelAcesso === 'mestre' && '👑'}</button>
        </div>
        {torneio.statusTorneio === 'aguardando_sorteio' && abaAtiva === 'jogos' && (
          <button className={`${styles.btnGerar} no-print`} onClick={torneio.gerarTabelaDinamica}>Embaralhar e Gerar Grupos</button>
        )}
      </div>

      <TabelaJogos abaAtiva={abaAtiva} partidas={torneio.partidas} regras={torneio.regras} />
      
      <Classificacao abaAtiva={abaAtiva} timesClassificacao={torneio.timesClassificacao} regras={torneio.regras} />
      
      <TelaoLive abaAtiva={abaAtiva} jogoAtual={torneio.jogoAtual} proximoJogo={torneio.proximoJogo} regras={torneio.regras} isInvertido={torneio.isInvertido} />
      
      <PainelMesa abaAtiva={abaAtiva} {...torneio} />
    </div>
  );
}