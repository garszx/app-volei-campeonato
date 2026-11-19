'use client';

import { useEffect, useState, use, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../../../../supabase';
import { Jogador, Partida, Regras, TimeDb } from '../../../../../types/torneio';

const FASES_EM_BRANCO: Record<string, { fase: string; label: string }> = {
  'semifinal-1': { fase: 'SEMIFINAL 1', label: 'Semifinal_1' },
  'semifinal-2': { fase: 'SEMIFINAL 2', label: 'Semifinal_2' },
  'terceiro-lugar': { fase: 'DISPUTA DE 3º LUGAR', label: 'Disputa_3_Lugar' },
  'final': { fase: 'FINAL', label: 'Final' },
};

export default function SumulaOficial({ params }: { params: Promise<{ id: string, partidaId: string }> }) {
  const { id, partidaId } = use(params);

  const [jogo, setJogo] = useState<Partida | null>(null);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  
  const sumulaRef = useRef<HTMLDivElement>(null);

  const faseEmBranco = FASES_EM_BRANCO[partidaId];

  useEffect(() => {
    async function carregarSumula() {
      const { data: torneioData } = await supabase.from('torneios').select('regras').eq('id', id).single();
      if (torneioData) setRegras(torneioData.regras);

      if (faseEmBranco) {
        const timeVazio = { id: '', nome: '________________', jogadores: [] } as unknown as TimeDb;
        setJogo({
          id: partidaId,
          fase: faseEmBranco.fase,
          horario: '___:___',
          status: 'pendente',
          pontosA: 0,
          pontosB: 0,
          setsVencidosA: 0,
          setsVencidosB: 0,
          parciais: '',
          timeA: timeVazio,
          timeB: timeVazio,
        } as unknown as Partida);
        setCarregando(false);
        return;
      }

      const { data: partidaData } = await supabase.from('partidas').select('*').eq('id', partidaId).single();
      
      if (torneioData && partidaData) {
        const { data: timeA } = await supabase.from('times').select('*').eq('id', partidaData.time_a_id).single();
        const { data: timeB } = await supabase.from('times').select('*').eq('id', partidaData.time_b_id).single();
        
        setJogo({
          ...partidaData,
          pontosA: partidaData.pontos_a,
          pontosB: partidaData.pontos_b,
          setsVencidosA: partidaData.sets_vencidos_a,
          setsVencidosB: partidaData.sets_vencidos_b,
          timeA: { ...timeA } as TimeDb,
          timeB: { ...timeB } as TimeDb,
        });
      }
      setCarregando(false);
    }
    carregarSumula();
  }, [id, partidaId, faseEmBranco]);

  const baixarPDF = async () => {
    if (!sumulaRef.current) return;
    setGerandoPDF(true);
    
    try {
      const canvas = await html2canvas(sumulaRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
      
      const margin = 4;
      const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2; 
      const pdfHeight = pdf.internal.pageSize.getHeight() - margin * 2; 
      
      pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth, pdfHeight);
      const nomeArquivo = faseEmBranco
        ? `Sumula_${faseEmBranco.label}.pdf`
        : `Sumula_${jogo?.timeA?.nome}_x_${jogo?.timeB?.nome}.pdf`;
      pdf.save(nomeArquivo);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (carregando) return <div style={{ padding: '2rem', textAlign: 'center', color: '#000' }}>Carregando súmula...</div>;
  if (!jogo) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Partida não encontrada.</div>;

  const arrayParciais = jogo.parciais ? jogo.parciais.split(',') : [];
  const isFinalizado = jogo.status === 'finalizado';
  const isMd3 = (jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3') ?? true;
  const numeroSets = isMd3 ? 3 : 5;

  const linhasResultado = Array.from({ length: numeroSets }).map((_, i) => {
    let pA: number | string = ''; let pB: number | string = ''; let vA: number | string = ''; let vB: number | string = '';
    if (arrayParciais[i]) {
      const [a, b] = arrayParciais[i].split('-');
      pA = Number(a); pB = Number(b); vA = pA > pB ? 1 : 0; vB = pB > pA ? 1 : 0;
    } else if (i === arrayParciais.length && !isFinalizado && (jogo.pontosA > 0 || jogo.pontosB > 0)) {
      pA = jogo.pontosA; pB = jogo.pontosB;
    }
    return { pA, pB, vA, vB };
  });

  const totalPtsA = linhasResultado.reduce((acc, curr) => acc + (typeof curr.pA === 'number' ? curr.pA : 0), 0);
  const totalPtsB = linhasResultado.reduce((acc, curr) => acc + (typeof curr.pB === 'number' ? curr.pB : 0), 0);

  const renderPontosGrid = (maxPontos = 40, compacto = false) => {
    const pts = [];
    for (let i = 1; i <= maxPontos; i++) {
      pts.push(<span key={i} className={compacto ? 'point-box-sm' : 'point-box'}>{i}</span>);
    }
    return <div className={compacto ? 'points-container-sm' : 'points-container'}>{pts}</div>;
  };

  const renderRotacoes = () => (
    <table className="rotation-table">
      <tbody>
        <tr style={{ backgroundColor: '#e5e5e5' }}>
          <td style={{ width: '16%', fontWeight: 'bold' }}>ORDEM</td>
          <td style={{ width: '14%', fontWeight: 'bold' }}>I</td><td style={{ width: '14%', fontWeight: 'bold' }}>II</td>
          <td style={{ width: '14%', fontWeight: 'bold' }}>III</td><td style={{ width: '14%', fontWeight: 'bold' }}>IV</td>
          <td style={{ width: '14%', fontWeight: 'bold' }}>V</td><td style={{ width: '14%', fontWeight: 'bold' }}>VI</td>
        </tr>
        <tr><td>INICIAL</td>{Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}</tr>
        <tr><td>SUBSTITUTO</td>{Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}</tr>
        <tr><td>PLACAR (IN)</td>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}</tr>
        <tr><td>PLACAR (OUT)</td>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}</tr>
        
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <tr key={`saque-${rowIndex}`}>
            {rowIndex === 0 && <td rowSpan={8} style={{ verticalAlign: 'middle', fontWeight: 'bold', fontSize: '9px', backgroundColor: '#f9f9f9' }}>SAQUES</td>}
            {Array.from({ length: 6 }).map((_, colIndex) => (
              <td key={colIndex} style={{ padding: 0, verticalAlign: 'top', height: '14px' }}>
                <div style={{ textAlign: 'left', fontSize: '6px', color: '#666', paddingLeft: '2px', paddingTop: '1px', lineHeight: '1' }}>
                  {rowIndex + 1}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Bloco individual (I a VI + Pontos + Tempos) usado nos 3 painéis do Tie-Break
  const renderBlocoTieBreak = (tituloTopo: string, isPosTroca = false) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: isPosTroca ? 'none' : '1px solid #000' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 4px', borderBottom: '1px solid #000', backgroundColor: '#f9f9f9', fontSize: '8px', fontWeight: 'bold' }}>
        <span>{tituloTopo}</span>
        {isPosTroca ? <span>PTS TROCA: ____</span> : <span>[ ]S [ ]R</span>}
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        <table className="rotation-table" style={{ flex: 1.7 }}>
          <tbody>
            <tr style={{ backgroundColor: '#e5e5e5' }}>
              <td style={{ fontWeight: 'bold' }}>I</td><td style={{ fontWeight: 'bold' }}>II</td>
              <td style={{ fontWeight: 'bold' }}>III</td><td style={{ fontWeight: 'bold' }}>IV</td>
              <td style={{ fontWeight: 'bold' }}>V</td><td style={{ fontWeight: 'bold' }}>VI</td>
            </tr>
            <tr>{Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}</tr>
            <tr>{Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}</tr>
            <tr>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}</tr>
            <tr>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}</tr>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={`tb-saque-${rowIndex}`}>
                {Array.from({ length: 6 }).map((_, colIndex) => (
                  <td key={colIndex} style={{ padding: 0, verticalAlign: 'top', height: '14px' }}>
                    <div style={{ textAlign: 'left', fontSize: '6px', color: '#666', paddingLeft: '1px', lineHeight: '1' }}>
                      {rowIndex + 1}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '1px solid #000', padding: '2px' }}>
          <div style={{ fontSize: '7px', fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '1px' }}>PONTOS</div>
          {renderPontosGrid(24, true)}
          <div style={{ borderTop: '1px solid #000', paddingTop: '2px', textAlign: 'center', fontSize: '8px', fontWeight: 'bold' }}>
            T: [ &nbsp; ] [ &nbsp; ]
          </div>
        </div>
      </div>
    </div>
  );

  // Quadro oficial do Tie-Break (Set 3 em MD3 ou Set 5 em MD5)
  const renderTieBreakGrid = (numSet: number) => (
    <div className="set-wrapper" key={numSet}>
      <div className="set-header">
        <span>SET {numSet} — TIE-BREAK (DECISIVO)</span>
        <span>INÍCIO: ___:___ | FIM: ___:___</span>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Coluna única de rótulos à esquerda */}
        <div style={{ width: '56px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #000', backgroundColor: '#f9f9f9' }}>
          <div style={{ padding: '3px 2px', borderBottom: '1px solid #000', fontSize: '7px', fontWeight: 'bold', textAlign: 'center' }}>EQUIPE</div>
          <table className="rotation-table" style={{ flex: 1 }}>
            <tbody>
              <tr style={{ backgroundColor: '#e5e5e5' }}><td style={{ fontWeight: 'bold' }}>ORDEM</td></tr>
              <tr><td>INICIAL</td></tr>
              <tr><td>SUB</td></tr>
              <tr><td>IN</td></tr>
              <tr><td>OUT</td></tr>
              <tr><td rowSpan={6} style={{ verticalAlign: 'middle', fontWeight: 'bold', fontSize: '8px', height: '84px' }}>SAQUES</td></tr>
            </tbody>
          </table>
        </div>

        {/* Painel 1: Lado Esquerdo (antes da troca) */}
        {renderBlocoTieBreak('EQ: ________')}

        {/* Painel 2: Lado Direito */}
        {renderBlocoTieBreak('EQ: ________')}

        {/* Divisor Vertical: TROCA DE LADO */}
        <div style={{
          width: '20px',
          backgroundColor: '#000',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: '8px',
          fontWeight: 'bold',
          lineHeight: '1.15',
          letterSpacing: '0.5px',
          padding: '2px 0'
        }}>
          {'TROCA DE LADO'.split('').map((char, idx) => (
            <span key={idx}>{char === ' ' ? '\u00A0' : char}</span>
          ))}
        </div>

        {/* Painel 3: Lado Esquerdo repetido (após a troca) */}
        {renderBlocoTieBreak('EQ: ________', true)}
      </div>
    </div>
  );

  const renderSetGrid = (numSet: number) => {
    // Se for o set decisivo (3º no MD3 ou 5º no MD5), usa o layout oficial de Tie-Break
    if (numSet === numeroSets) {
      return renderTieBreakGrid(numSet);
    }

    return (
      <div className="set-wrapper" key={numSet}>
        <div className="set-header">
          <span>SET {numSet}</span>
          <span>SORTEIO: [ &nbsp;] SAQUE &nbsp; [ &nbsp;] RECEPÇÃO</span>
          <span>INÍCIO: ___:___ | FIM: ___:___</span>
        </div>
        <table className="table-bordered" style={{ borderTop: 'none', height: '100%' }}>
          <tbody>
            <tr>
              <td style={{ width: '13%', borderTop: 'none' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px', wordBreak: 'break-word' }}>{jogo.timeA.nome}</div>
                <div style={{ fontSize: '10px', marginTop: '10px' }}>Tempos:</div>
                <div style={{ fontSize: '10px' }}>[ &nbsp;&nbsp; ] [ &nbsp;&nbsp; ]</div>
              </td>
              <td style={{ width: '47%', backgroundColor: '#f9f9f9', padding: '0', borderTop: 'none' }}>{renderRotacoes()}</td>
              <td style={{ width: '40%', padding: '3px', borderTop: 'none' }}>{renderPontosGrid()}</td>
            </tr>
            <tr>
              <td style={{ width: '13%' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px', wordBreak: 'break-word' }}>{jogo.timeB.nome}</div>
                <div style={{ fontSize: '10px', marginTop: '10px' }}>Tempos:</div>
                <div style={{ fontSize: '10px' }}>[ &nbsp;&nbsp; ] [ &nbsp;&nbsp; ]</div>
              </td>
              <td style={{ width: '47%', backgroundColor: '#f9f9f9', padding: '0' }}>{renderRotacoes()}</td>
              <td style={{ width: '40%', padding: '3px' }}>{renderPontosGrid()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderEscalacao = (time: TimeDb, isEquipeA: boolean) => {
    const lista = (time.jogadores || []) as Jogador[];
    const linhaJogadores = lista.filter((j) => !j.isLibero);
    const liberos = lista.filter((j) => j.isLibero);

    return (
      <div className="roster-wrapper">
        <div className="section-title">EQUIPE {isEquipeA ? 'A' : 'B'}: {time.nome}</div>
        <table className="table-bordered table-sm">
          <thead>
            <tr><th style={{ width: '15%' }}>Nº</th><th>NOME DO JOGADOR</th></tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }).map((_, i) => {
              const atleta = linhaJogadores[i];
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 'bold' }}>{atleta?.numero || '\u00A0'}</td>
                  <td style={{ textAlign: 'left', paddingLeft: '6px' }}>{atleta?.nome || '\u00A0'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: '10px', padding: '4px', borderTop: '1px solid #000' }}>LÍBEROS:</div>
        <div style={{ display: 'flex', borderTop: '1px solid #000', fontSize: '10px' }}>
          <div style={{ flex: 1, padding: '4px', borderRight: '1px solid #000' }}>
            Nº {liberos[0] ? `${liberos[0].numero} - ${liberos[0].nome}` : '___'}
          </div>
          <div style={{ flex: 1, padding: '4px' }}>
            Nº {liberos[1] ? `${liberos[1].numero} - ${liberos[1].nome}` : '___'}
          </div>
        </div>
        <div style={{ padding: '6px', borderTop: '1px solid #000', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
          Assinatura Capitão: ____________________
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#e2e8f0', minHeight: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
        <button 
          onClick={baixarPDF} 
          disabled={gerandoPDF}
          style={{ padding: '12px 24px', backgroundColor: gerandoPDF ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          {gerandoPDF ? '⏳ Gerando documento...' : '📥 Baixar Súmula Oficial (PDF)'}
        </button>
      </div>

      <div ref={sumulaRef} className="cbv-container">
        
        <div className="header-box">
          <div style={{ flex: 1, padding: '10px', borderRight: '2px solid #000' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '18px', textTransform: 'uppercase' }}>{regras?.nomeCampeonato || 'Campeonato de Voleibol'}</h1>
            <div style={{ fontSize: '12px', display: 'flex', gap: '20px' }}>
              <span><b>FASE:</b> {jogo.fase.toUpperCase()}</span><span><b>JOGO Nº:</b> {jogo.ordem || jogo.numero || '____'}</span><span><b>NAIPE:</b> [ ] M [ ] F</span>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', gap: '20px', marginTop: '6px' }}>
              <span><b>DATA:</b> ___/___/20__</span><span><b>HORÁRIO OFICIAL:</b> {jogo.horario}</span><span><b>CIDADE:</b> ___________________</span>
            </div>
          </div>
          <div style={{ width: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e5e5', fontWeight: '900', fontSize: '16px', textAlign: 'center' }}>
            SÚMULA OFICIAL<br/>DE VOLEIBOL
          </div>
        </div>

        <div className="main-grid">
          
          <div className="left-col">
            {Array.from({ length: isMd3 ? 2 : 3 }).map((_, i) => renderSetGrid(i + 1))}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <div className="roster-wrapper" style={{ flex: 1.2 }}>
                <div className="section-title">SANÇÕES</div>
                <table className="table-bordered table-sm" style={{ fontSize: '10px' }}>
                  <thead><tr><th>A</th><th>P</th><th>E</th><th>D</th><th>A/B</th><th>SET</th><th>PLACAR</th></tr></thead>
                  <tbody>{Array.from({ length: 4 }).map((_, i) => <tr key={i}><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>)}</tbody>
                </table>
              </div>
              <div className="roster-wrapper" style={{ flex: 2 }}>
                <div className="section-title">OBSERVAÇÕES</div>
                <div style={{ height: '78px', padding: '4px', fontSize: '11px', borderBottom: '1px solid #ccc' }}></div>
              </div>
            </div>
          </div>

          <div className="right-col">
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ flex: 1 }}>{renderEscalacao(jogo.timeA as TimeDb, true)}</div>
              <div style={{ flex: 1 }}>{renderEscalacao(jogo.timeB as TimeDb, false)}</div>
            </div>

            <div className="roster-wrapper" style={{ marginTop: '6px' }}>
              <div className="section-title">APROVAÇÃO (ARBITRAGEM)</div>
              <table className="table-bordered table-sm" style={{ fontSize: '11px', textAlign: 'left' }}>
                <tbody>
                  <tr><td style={{ width: '60%' }}>1º Árbitro:</td><td>Assinatura:</td></tr>
                  <tr><td>2º Árbitro:</td><td>Assinatura:</td></tr>
                  <tr><td>Apontador:</td><td>Assinatura:</td></tr>
                  <tr><td>Juiz de Linha 1: ______________</td><td>Juiz 3: ______________</td></tr>
                  <tr><td>Juiz de Linha 2: ______________</td><td>Juiz 4: ______________</td></tr>
                </tbody>
              </table>
            </div>

            <div className="roster-wrapper" style={{ marginTop: '6px', border: '2px solid #000' }}>
              <div className="section-title" style={{ backgroundColor: '#000', color: '#fff' }}>RESULTADOS</div>
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 'bold', borderRight: '1px solid #000', padding: '4px' }}>{jogo.timeA.nome}</div>
                <div style={{ width: '35px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', borderRight: '1px solid #000', padding: '4px' }}>SET</div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 'bold', padding: '4px' }}>{jogo.timeB.nome}</div>
              </div>

              <table className="table-bordered table-sm" style={{ fontSize: '11px', borderTop: 'none' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ width: '12%' }}>T</th><th style={{ width: '12%' }}>S</th><th style={{ width: '12%' }}>V</th><th style={{ width: '14%' }}>P</th>
                    <th style={{ width: '10%' }}>Nº</th>
                    <th style={{ width: '14%' }}>P</th><th style={{ width: '12%' }}>V</th><th style={{ width: '12%' }}>S</th><th style={{ width: '12%' }}>T</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasResultado.map((linha, i) => (
                    <tr key={i}>
                      <td></td><td></td><td style={{ fontWeight: 'bold' }}>{linha.vA}</td><td style={{ fontWeight: 'bold', fontSize: '12px' }}>{linha.pA}</td>
                      <td style={{ backgroundColor: '#e5e5e5', fontWeight: 'bold' }}>{i + 1}</td>
                      <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{linha.pB}</td><td style={{ fontWeight: 'bold' }}>{linha.vB}</td><td></td><td></td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f9f9f9' }}>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '4px' }}>TOTAL</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{isFinalizado ? jogo.setsVencidosA : ''}</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{isFinalizado ? totalPtsA : ''}</td>
                    <td style={{ backgroundColor: '#000', color: '#fff', fontWeight: 'bold' }}>T</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{isFinalizado ? totalPtsB : ''}</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{isFinalizado ? jogo.setsVencidosB : ''}</td>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '4px' }}>TOTAL</td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{ padding: '6px', textAlign: 'center', fontSize: '12px', borderTop: '1px solid #000', backgroundColor: '#e5e5e5' }}>
                <b>VENCEDOR: </b> {isFinalizado ? ((jogo.setsVencidosA || 0) > (jogo.setsVencidosB || 0) ? jogo.timeA.nome.toUpperCase() : jogo.timeB.nome.toUpperCase()) : '________________________________'}
              </div>
            </div>

            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {Array.from({ length: isMd3 ? 1 : 2 }).map((_, i) => renderSetGrid((isMd3 ? 3 : 4) + i))}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .cbv-container { font-family: 'Arial', sans-serif; color: #000; font-size: 11px; background: #fff; width: 1760px; margin: 0 auto; box-sizing: border-box; border: 1px solid #000; padding: 10px; display: flex; flex-direction: column; }
        .header-box { display: flex; border: 2px solid #000; margin-bottom: 8px; }
        .main-grid { display: flex; gap: 10px; flex: 1; }
        .left-col { flex: 1.05; display: flex; flex-direction: column; gap: 8px; }
        .right-col { flex: 1.1; display: flex; flex-direction: column; }
        
        .table-bordered { border-collapse: collapse; width: 100%; text-align: center; }
        .table-bordered th, .table-bordered td { border: 1px solid #000; padding: 3px; }
        .table-sm td, .table-sm th { padding: 2px !important; height: 18px; }
        
        .section-title { font-weight: bold; background-color: #e5e5e5; text-transform: uppercase; border-bottom: 1px solid #000; padding: 4px; text-align: center; font-size: 11px; }
        .set-wrapper { border: 2px solid #000; display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .set-header { display: flex; justify-content: space-between; font-weight: bold; background-color: #e5e5e5; border-bottom: 1px solid #000; padding: 4px 8px; font-size: 11px; }
        
        .rotation-table { border-collapse: collapse; width: 100%; text-align: center; font-size: 8px; table-layout: fixed; height: 100%; }
        .rotation-table td { border: 1px solid #000; padding: 1px; height: 14px; }
        
        .points-container { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px; justify-content: flex-start; }
        .point-box { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #999; font-size: 8px; color: #333; font-weight: bold; }
        
        .points-container-sm { display: flex; flex-wrap: wrap; gap: 1px; padding: 2px 0; justify-content: center; }
        .point-box-sm { width: 14px; height: 13px; display: flex; align-items: center; justify-content: center; border: 1px solid #999; font-size: 7px; color: #333; font-weight: bold; }
        
        .roster-wrapper { border: 1px solid #000; }
      `}} />
    </div>
  );
}