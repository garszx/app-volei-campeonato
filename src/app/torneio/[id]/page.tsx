"use client";

import Image from 'next/image';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './tabela.module.css';

import { useTorneio } from '../../../hooks/useTorneio';
import { Regras } from '../../../types/torneio';

import TabelaJogos from '../../../components/torneio/TabelaJogos';
import Classificacao from '../../../components/torneio/Classificacao';
import TelaoLive from '../../../components/torneio/TelaoLive';
import PainelMesa from '../../../components/torneio/PainelMesa';
import ConfiguracaoTema from '../../../components/torneio/PainelMesa/ConfiguracaoTema';

export default function HubTorneio() {
  const params = useParams();
  const torneioId = params.id as string;
  
  const [abaAtiva, setAbaAtiva] = useState<'jogos' | 'classificacao' | 'live' | 'admin'>('jogos');
  const [regrasAtualizadas, setRegrasAtualizadas] = useState<Regras | null>(null);

  const torneio = useTorneio(torneioId);

  // Usa as regras recém-salvas na hora, ou as que vieram do banco
  const regrasAtivas = regrasAtualizadas || torneio.regras;
  const corDestaque = regrasAtivas?.corPrimaria || 'var(--cor-destaque, #3b82f6)';

  const trocarAba = (novaAba: 'jogos' | 'classificacao' | 'live' | 'admin') => {
    setAbaAtiva(novaAba);
    torneio.setPartidaEditando(null);
    torneio.setMostrarEditorEquipes(false);
  };

  return (
    <div
      className={styles.container}
      style={{
        '--cor-destaque': corDestaque,
        '--btn-bg': corDestaque,
      } as React.CSSProperties}
    >
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          {regrasAtivas?.logoUrl && (
            <Image
              src={regrasAtivas.logoUrl}
              alt="Logo do Torneio"
              width={44}
              height={44}
              unoptimized
              style={{ objectFit: 'contain', borderRadius: '8px' }}
            />
          )}
          <h1 className={styles.title}>{regrasAtivas?.nomeCampeonato || 'Carregando...'}</h1>
        </div>

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

      {/* Painel de Aparência aparece apenas para quem entrou com a senha mestre */}
      {abaAtiva === 'admin' && torneio.nivelAcesso === 'mestre' && regrasAtivas && (
        <ConfiguracaoTema
          torneioId={torneioId}
          regrasAtuais={regrasAtivas}
          aoAtualizar={(novasRegras) => setRegrasAtualizadas(novasRegras)}
        />
      )}

      <TabelaJogos abaAtiva={abaAtiva} partidas={torneio.partidas} regras={regrasAtivas} />
      
      <Classificacao abaAtiva={abaAtiva} timesClassificacao={torneio.timesClassificacao} regras={regrasAtivas} />
      
      <TelaoLive abaAtiva={abaAtiva} jogoAtual={torneio.jogoAtual} proximoJogo={torneio.proximoJogo} regras={regrasAtivas} isInvertido={torneio.isInvertido} />
      
      <PainelMesa abaAtiva={abaAtiva} {...torneio} regras={regrasAtivas} />
    </div>
  );
}