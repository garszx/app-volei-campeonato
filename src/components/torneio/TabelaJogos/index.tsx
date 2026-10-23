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

  return (
    <div className={styles.showOnPrint}>
      <h2 className={`${styles.hideOnScreen} ${styles.printTitle}`}>Tabela de Jogos</h2>
      <div className={styles.listaJogos}>
        {partidas.map((jogo) => {
          const num = jogo.id.split('_')[1];
          let classeStatus = styles.statusPendente; let textoStatus = 'Aguardando';
          
          if (jogo.status === 'em_andamento') { classeStatus = styles.statusAndamento; textoStatus = 'Ao Vivo'; }
          if (jogo.status === 'finalizado') { classeStatus = styles.statusFinalizado; textoStatus = 'Finalizado'; }
          
          const isMd3 = (jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3');

          return (
            <div key={jogo.id} className={styles.cardJogo}>
              <div className={styles.cardTop}>
                <span className={styles.jogoNumero}>{jogo.fase === 'final' ? '🏆 GRANDE FINAL' : jogo.fase === 'terceiro_lugar' ? '🥉 Disputa 3º' : jogo.fase === 'semifinal' ? `Semifinal` : `Jogo ${num}`}</span>
                <span className={styles.horario}>{jogo.horario}</span>
              </div>
              <div className={styles.confronto}>
                <div className={styles.time}>
                  {regras?.mostrarLogos && <Image src={jogo.timeA.escudoUrl} alt="A" className={`${styles.escudo} ${styles.imageContain}`} width={50} height={50} />} 
                  <span>{jogo.timeA.nome}</span>
                </div>
                <div className={styles.placarCentral}>
                  {isMd3 && jogo.status !== 'pendente' && <span className={styles.setsLabel}>Sets: {jogo.setsVencidosA || 0} - {jogo.setsVencidosB || 0}</span>}
                  <span className={styles.placarNumeros}>{jogo.status === 'pendente' ? 'X' : `${jogo.pontosA} - ${jogo.pontosB}`}</span>
                  <span className={`${styles.statusTag} ${classeStatus}`}>{textoStatus}</span>
                </div>
                <div className={styles.time}>
                  {regras?.mostrarLogos && <Image src={jogo.timeB.escudoUrl} alt="B" className={`${styles.escudo} ${styles.imageContain}`} width={50} height={50} />} 
                  <span>{jogo.timeB.nome}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}