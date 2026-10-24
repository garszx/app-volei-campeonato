import Image from 'next/image';
import { Partida, Regras } from '../../../types/torneio';
import styles from './TabelaJogos.module.css';

interface TabelaJogosProps {
  abaAtiva: string;
  partidas: Partida[];
  regras: Regras | null;
}

export default function TabelaJogos({ abaAtiva, partidas, regras }: TabelaJogosProps) {
  if (abaAtiva !== 'jogos') return null;

  const verificarInversao = (jogo: Partida): boolean => {
    if (jogo.status !== 'em_andamento') return false; 
    const formato = jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais;
    if (!formato?.includes('melhor_de_3')) return false;
    const setsJogados = (jogo.setsVencidosA || 0) + (jogo.setsVencidosB || 0);
    if (setsJogados === 1) return true;
    if (setsJogados === 2 && Math.max(jogo.pontosA, jogo.pontosB) >= 8) return true;
    return false;
  };

  const renderParciais = (parciaisStr: string, isInv: boolean) => (
    <div className={styles.parciaisContainer}>
      {parciaisStr.split(',').map((parcial, i) => {
        const partes = parcial.split('-');
        if (partes.length !== 2) return null;
        const ptsA = Number(partes[0]);
        const ptsB = Number(partes[1]);
        const visualA = isInv ? ptsB : ptsA;
        const visualB = isInv ? ptsA : ptsB;

        return (
          <div key={i} className={styles.parcialTag}>
            <span className={visualA > visualB ? styles.parcialVencedor : styles.parcialPerdedor}>{visualA}</span>
            <span className={styles.parcialDivisor}>-</span>
            <span className={visualB > visualA ? styles.parcialVencedor : styles.parcialPerdedor}>{visualB}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`${styles.showOnPrint}`}>
      <h2 className={`${styles.hideOnScreen} ${styles.printTitle}`}>Tabela de Jogos</h2>
      
      <div className={styles.listaJogos}>
        {partidas.map((p, idx) => {
          const isInv = verificarInversao(p);
          
          const tA = isInv ? p.timeB : p.timeA;
          const tB = isInv ? p.timeA : p.timeB;
          const ptsA = isInv ? p.pontosB : p.pontosA;
          const ptsB = isInv ? p.pontosA : p.pontosB;
          const setsA = isInv ? p.setsVencidosB : p.setsVencidosA;
          const setsB = isInv ? p.setsVencidosA : p.setsVencidosB;
          
          const isMd3 = (p.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3');

          return (
            <div key={p.id} className={styles.cardJogo}>
              <div className={styles.cardTop}>
                <span className={styles.jogoNumero}>
                  {p.fase === 'final' ? 'GRANDE FINAL' : p.fase === 'semifinal' ? `SEMIFINAL` : `JOGO ${idx + 1}`}
                </span>
                <span className={styles.horario}>{p.horario}</span>
              </div>
              
              <div className={styles.confronto}>
                <div className={styles.time}>
                  {regras?.mostrarLogos && (
                    <div className={styles.escudo}>
                      <Image src={tA.escudoUrl} alt="A" width={45} height={45} className={styles.imageContain} />
                    </div>
                  )}
                  <span>{tA.nome}</span>
                </div>

                <div className={styles.placarCentral}>
                  {isMd3 && (
                    <span className={styles.setsLabel}>SETS: {setsA || 0} - {setsB || 0}</span>
                  )}
                  
                  {p.status === 'pendente' ? (
                    <span className={styles.placarNumeros}>X</span>
                  ) : p.status === 'finalizado' ? (
                    <>
                      {p.parciais ? renderParciais(p.parciais, isInv) : <span className={styles.placarNumeros}>{ptsA} - {ptsB}</span>}
                    </>
                  ) : (
                    <>
                      <span className={styles.placarNumeros}>{ptsA} - {ptsB}</span>
                      {p.parciais && renderParciais(p.parciais, isInv)}
                    </>
                  )}

                  <span className={`${styles.statusTag} ${
                    p.status === 'finalizado' ? styles.statusFinalizado : 
                    p.status === 'em_andamento' ? styles.statusAndamento : 
                    styles.statusPendente
                  }`}>
                    {p.status === 'finalizado' ? 'FINALIZADO' : 
                     p.status === 'em_andamento' ? 'AO VIVO' : 
                     'AGUARDANDO'}
                  </span>
                </div>

                <div className={styles.time}>
                  {regras?.mostrarLogos && (
                    <div className={styles.escudo}>
                      <Image src={tB.escudoUrl} alt="B" width={45} height={45} className={styles.imageContain} />
                    </div>
                  )}
                  <span>{tB.nome}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}