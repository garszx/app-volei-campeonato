import Image from 'next/image';
import { Partida, Regras } from '../../../types/torneio';
import styles from './TelaoLive.module.css';

interface TelaoLiveProps {
  abaAtiva: string;
  jogoAtual: Partida | undefined;
  proximoJogo: Partida | undefined;
  regras: Regras | null;
  isInvertido: boolean;
}

export default function TelaoLive({ abaAtiva, jogoAtual, proximoJogo, regras, isInvertido }: TelaoLiveProps) {
  if (abaAtiva !== 'live') return null;

  const tA_Live = isInvertido && jogoAtual ? jogoAtual.timeB : jogoAtual?.timeA;
  const tB_Live = isInvertido && jogoAtual ? jogoAtual.timeA : jogoAtual?.timeB;
  const ptsA_Live = isInvertido && jogoAtual ? jogoAtual.pontosB : jogoAtual?.pontosA;
  const ptsB_Live = isInvertido && jogoAtual ? jogoAtual.pontosA : jogoAtual?.pontosB;
  const setsA_Live = isInvertido && jogoAtual ? jogoAtual.setsVencidosB : jogoAtual?.setsVencidosA;
  const setsB_Live = isInvertido && jogoAtual ? jogoAtual.setsVencidosA : jogoAtual?.setsVencidosB;
  const isMd3Shared = (jogoAtual?.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3');

  return (
    <div className={`${styles.hideOnPrint}`}>
      <div className={styles.liveContainer}>
        {jogoAtual && tA_Live && tB_Live ? (
          <>
            <div className={styles.headerLive}>
              <span className={styles.liveBadge}>AO VIVO</span> 
              <span className={styles.horarioBadge}>{jogoAtual.horario}</span>
            </div>
            
            {isMd3Shared && (
              <div className={styles.setsInfo}>
                Placar de Sets: <strong>{setsA_Live || 0}</strong> x <strong>{setsB_Live || 0}</strong>
              </div>
            )}
            
            <div className={styles.placarLive}>
              <div className={styles.timeCol}>
                {regras?.mostrarLogos && (
                  <div className={styles.escudoWrapper}>
                    <Image src={tA_Live.escudoUrl} alt="A" className={`${styles.escudoLive} ${styles.imageContain}`} width={90} height={90} />
                  </div>
                )}
                <h3 className={styles.timeNomeLive}>{tA_Live.nome}</h3> 
                <span className={styles.pontuacao}>{ptsA_Live}</span>
              </div>
              
              <div className={styles.vsCard}>
                <span className={styles.vsText}>X</span>
              </div>
              
              <div className={styles.timeCol}>
                {regras?.mostrarLogos && (
                  <div className={styles.escudoWrapper}>
                    <Image src={tB_Live.escudoUrl} alt="B" className={`${styles.escudoLive} ${styles.imageContain}`} width={90} height={90} />
                  </div>
                )}
                <h3 className={styles.timeNomeLive}>{tB_Live.nome}</h3> 
                <span className={styles.pontuacao}>{ptsB_Live}</span>
              </div>
            </div>
          </>
        ) : proximoJogo ? (
          <>
            <div className={styles.headerLive}>
              <span className={styles.horarioBadge} style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>Próxima Partida</span> 
              <span className={styles.horarioBadge}>{proximoJogo.horario}</span>
            </div>
            
            <div className={styles.placarLive}>
              <div className={styles.timeCol}>
                {regras?.mostrarLogos && (
                  <div className={styles.escudoWrapper}>
                    <Image src={proximoJogo.timeA.escudoUrl} alt="A" className={`${styles.escudoLive} ${styles.imageContain}`} width={90} height={90} />
                  </div>
                )}
                <h3 className={styles.timeNomeLive}>{proximoJogo.timeA.nome}</h3> 
                <span className={styles.pontuacao}>0</span>
              </div>
              
              <div className={styles.vsCard}>
                <span className={styles.vsText}>X</span>
              </div>
              
              <div className={styles.timeCol}>
                {regras?.mostrarLogos && (
                  <div className={styles.escudoWrapper}>
                    <Image src={proximoJogo.timeB.escudoUrl} alt="B" className={`${styles.escudoLive} ${styles.imageContain}`} width={90} height={90} />
                  </div>
                )}
                <h3 className={styles.timeNomeLive}>{proximoJogo.timeB.nome}</h3> 
                <span className={styles.pontuacao}>0</span>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.mensagemEspera}>
            <h2>Torneio Finalizado! 🏆</h2>
          </div>
        )}
      </div>
    </div>
  );
}