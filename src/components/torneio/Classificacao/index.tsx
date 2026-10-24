import Image from 'next/image';
import { Regras, TimeDb } from '../../../types/torneio';
import styles from './Classificacao.module.css';

interface ClassificacaoProps {
  abaAtiva: string;
  timesClassificacao: TimeDb[];
  regras: Regras | null;
}

export default function Classificacao({ abaAtiva, timesClassificacao, regras }: ClassificacaoProps) {
  if (abaAtiva !== 'classificacao') return null;

  const timesChaveA = timesClassificacao.filter(t => t.chave === 'A');
  const timesChaveB = timesClassificacao.filter(t => t.chave === 'B');
  const timesUnica = timesClassificacao.filter(t => !t.chave || t.chave === 'U');

  const renderTabela = (timesParaRender: TimeDb[], titulo: string) => (
    <div className={styles.tableCard}>
      <h3 className={styles.tableTitle}>{titulo}</h3>
      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          <table className={styles.tableClassificacao}>
            <thead>
              <tr>
                <th>Pos</th>
                <th className={styles.textLeft}>Time</th>
                {regras?.sistemaClassificacao === 'sistema_pontos' ? <th>Pts</th> : <th>Vit</th>}
                <th>Sets (V-P)</th>
                <th>Set Avg</th>
                <th>Pts Avg</th>
              </tr>
            </thead>
            <tbody>
              {timesParaRender.map((time, index) => {
                // A UI vai puxar os pontos reais se for sistema de pontos, ou as vitórias processadas pelo backend.
                const valorPrincipal = time.pontos_classificacao || 0;

                return (
                  <tr key={time.id}>
                    <td className={styles.rank}>{index + 1}º</td>
                    <td>
                      <div className={styles.teamCell}>
                        {regras?.mostrarLogos && (
                          <div className={styles.escudoWrapperClassif}>
                             <Image src={time.escudoUrl} alt="Escudo" width={30} height={30} className={styles.imageContain} />
                          </div>
                        )} 
                        {time.nome}
                      </div>
                    </td>
                    <td className={styles.pontosClassificacao}>{valorPrincipal}</td>
                    <td className={styles.vitorias}>{time.sets_vencidos || 0} - {time.sets_perdidos || 0}</td>
                    <td className={styles.boldText}>{(time.sets_average || 0).toFixed(2).replace('.00', '')}</td>
                    <td className={styles.boldText}>{(time.points_average || 0).toFixed(2).replace('.00', '')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.showOnPrint} ${styles.printPageBreak}`}>
      <h2 className={`${styles.hideOnScreen} ${styles.printTitle}`}>Classificação Final</h2>
      <div className={styles.centerContainer}>
        {timesUnica.length > 0 && renderTabela(timesUnica, '🏆 Classificação Geral (Chave Única)')}
        {timesChaveA.length > 0 && renderTabela(timesChaveA, '🏆 Classificação - Grupo A')}
        {timesChaveB.length > 0 && renderTabela(timesChaveB, '🏆 Classificação - Grupo B')}
        <p className={styles.rodapeAviso}>
          * Desempates baseados no Artigo 19º: 1º Pontos/Vitórias, 2º Set Average, 3º Point Average.
        </p>
      </div>
    </div>
  );
}