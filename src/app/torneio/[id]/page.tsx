"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';
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

  const regrasAtivas = regrasAtualizadas || torneio.regras;
  const corDestaque = regrasAtivas?.corPrimaria || '#3b82f6';
  const isTemaPadrao = !regrasAtivas?.corPrimaria || regrasAtivas.corPrimaria === '#3b82f6';

  useEffect(() => {
    const fundoAnterior = document.body.style.backgroundColor;
    document.body.style.backgroundColor = isTemaPadrao ? '#0f172a' : '#09090b';
    return () => {
      document.body.style.backgroundColor = fundoAnterior;
    };
  }, [isTemaPadrao]);

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
        '--background': isTemaPadrao ? '#0f172a' : '#09090b',
        '--card-bg': isTemaPadrao ? '#1e293b' : '#18181b',
        '--card-border': isTemaPadrao ? '#334155' : 'rgba(255, 255, 255, 0.14)',
        position: 'relative',
      } as React.CSSProperties}
    >
      {/* Marca d'água da logo no fundo (responsiva para desktop e mobile) */}
      {regrasAtivas?.logoUrl && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            backgroundImage: `url(${regrasAtivas.logoUrl})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'min(80vw, 600px)',
            opacity: 0.08,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
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
    </div>
  );
}