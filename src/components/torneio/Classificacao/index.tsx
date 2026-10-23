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
    <div style={{ marginBottom: '40px' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '15px', color: '#38bdf8', fontSize: '24px' }}>{titulo}</h3>
      <div className={styles.tableWrapper}>
        <div className={styles.tableContainer}>
          <table className={styles.tableClassificacao}>
            <thead>
              <tr>
                <th>Pos</th><th className={styles.textLeft}>Time</th>
                {regras?.sistemaClassificacao === 'sistema_pontos' ? <th>Pts</th> : <th>Vit</th>}
                <th>Sets (V-P)</th>
                <th>Set Avg</th>
                <th>Pts Avg</th>
              </tr>
            </thead>
            <tbody>
              {timesParaRender.map((time, index) => (
                <tr key={time.id}>
                  <td className={styles.rank}>{index + 1}º</td>
                  <td>
                    <div className={styles.teamCell}>
                      {regras?.mostrarLogos && (
                        <Image src={time.escudoUrl} alt="Escudo" width={35} height={35} className={`${styles.escudo} ${styles.imageContain}`} />
                      )} 
                      {time.nome}
                    </div>
                  </td>
                  <td className={styles.pontosClassificacao}>{regras?.sistemaClassificacao === 'sistema_pontos' ? (time.pontos_classificacao || 0) : (time.sets_vencidos || 0)}</td>
                  <td className={styles.vitorias}>{time.sets_vencidos || 0} - {time.sets_perdidos || 0}</td>
                  <td className={styles.boldText}>{(time.sets_average || 0).toFixed(2).replace('.00', '')}</td>
                  <td className={styles.boldText}>{(time.points_average || 0).toFixed(2).replace('.00', '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${styles.showOnPrint} ${styles.printPageBreak}`}>
      <h2 className={`${styles.hideOnScreen} ${styles.printTitle}`}>Classificação Final</h2>
      {timesUnica.length > 0 && renderTabela(timesUnica, 'Classificação Geral (Chave Única)')}
      {timesChaveA.length > 0 && renderTabela(timesChaveA, '🏆 Classificação - Grupo A')}
      {timesChaveB.length > 0 && renderTabela(timesChaveB, '🏆 Classificação - Grupo B')}
      <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>
        * Desempates baseados no Artigo 19º: 1º Pontos/Vitórias, 2º Set Average, 3º Point Average.
      </p>
    </div>
  );
}