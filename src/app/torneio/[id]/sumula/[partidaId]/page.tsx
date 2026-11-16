'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../../../../../supabase';
import { Partida, Regras, TimeDb } from '../../../../../types/torneio';

export default function SumulaOficial({ params }: { params: Promise<{ id: string, partidaId: string }> }) {
  const { id, partidaId } = use(params);

  const [jogo, setJogo] = useState<Partida | null>(null);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [carregando, setCarregando] = useState(true);
  
  // Referência atualizada para o react-to-print v3
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function carregarSumula() {
      const { data: torneioData } = await supabase.from('torneios').select('regras').eq('id', id).single();
      const { data: partidaData } = await supabase.from('partidas').select('*').eq('id', partidaId).single();
      
      if (torneioData && partidaData) {
        setRegras(torneioData.regras);
        
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
  }, [id, partidaId]);

  // Função de impressão corrigida para a v3
  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: `Sumula_${jogo?.timeA?.nome}_x_${jogo?.timeB?.nome}`,
  });

  if (carregando) return <div style={{ padding: '2rem', textAlign: 'center', color: '#000' }}>A carregar súmula...</div>;
  if (!jogo) return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Partida não encontrada.</div>;

  const arrayParciais = jogo.parciais ? jogo.parciais.split(',') : [];
  const isFinalizado = jogo.status === 'finalizado';
  const isMd3 = (jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3');
  const numeroSets = isMd3 ? 3 : 5;

  const linhasResultado = Array.from({ length: numeroSets }).map((_, i) => {
    let pA: number | string = '';
    let pB: number | string = '';
    let vA: number | string = '';
    let vB: number | string = '';

    if (arrayParciais[i]) {
      const [a, b] = arrayParciais[i].split('-');
      pA = Number(a);
      pB = Number(b);
      vA = pA > pB ? 1 : 0;
      vB = pB > pA ? 1 : 0;
    } else if (i === arrayParciais.length && !isFinalizado && (jogo.pontosA > 0 || jogo.pontosB > 0)) {
      pA = jogo.pontosA;
      pB = jogo.pontosB;
    }
    return { pA, pB, vA, vB };
  });

  const totalPtsA = linhasResultado.reduce((acc, curr) => acc + (typeof curr.pA === 'number' ? curr.pA : 0), 0);
  const totalPtsB = linhasResultado.reduce((acc, curr) => acc + (typeof curr.pB === 'number' ? curr.pB : 0), 0);

  const renderPontosGrid = () => {
    const pts = [];
    for (let i = 1; i <= 40; i++) {
      pts.push(<span key={i} className="point-box">{i}</span>);
    }
    return <div className="points-container">{pts}</div>;
  };

  const renderRotacoes = () => (
    <table className="rotation-table">
      <tbody>
        <tr style={{ backgroundColor: '#e5e5e5' }}>
          <td style={{ width: '22%', fontWeight: 'bold' }}>ORDEM</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>I</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>II</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>III</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>IV</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>V</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>VI</td>
        </tr>
        <tr><td>INICIAL</td>{Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}</tr>
        <tr><td>SUBSTITUTO</td>{Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}</tr>
        <tr><td>PLACAR (IN)</td>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}</tr>
        <tr><td>PLACAR (OUT)</td>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}</tr>
        <tr><td>SAQUE 1</td>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#999' }}>[ ]</td>)}</tr>
        <tr><td>SAQUE 2</td>{Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#999' }}>[ ]</td>)}</tr>
      </tbody>
    </table>
  );

  const renderSetGrid = (numSet: number) => (
    <div className="set-wrapper" key={numSet}>
      <div className="set-header">
        <span>SET {numSet}</span>
        <span>SORTEIO: [ &nbsp;] SAQUE &nbsp; [ &nbsp;] RECEPÇÃO</span>
        <span>INÍCIO: ___:___ | FIM: ___:___</span>
      </div>
      <div>
        <table className="table-bordered" style={{ borderTop: 'none' }}>
          <tbody>
            <tr>
              <td style={{ width: '13%', borderTop: 'none' }}>
                <div className="team-name" style={{ fontWeight: 'bold', marginBottom: '2px', wordBreak: 'break-word' }}>{jogo.timeA.nome}</div>
                <div className="tempos-text">Tempos:<br/>[ &nbsp;&nbsp; ] [ &nbsp;&nbsp; ]</div>
              </td>
              <td style={{ width: '47%', backgroundColor: '#f9f9f9', padding: '0', borderTop: 'none' }}>{renderRotacoes()}</td>
              <td style={{ width: '40%', padding: '1px', borderTop: 'none' }}>{renderPontosGrid()}</td>
            </tr>
            <tr>
              <td style={{ width: '13%' }}>
                <div className="team-name" style={{ fontWeight: 'bold', marginBottom: '2px', wordBreak: 'break-word' }}>{jogo.timeB.nome}</div>
                <div className="tempos-text">Tempos:<br/>[ &nbsp;&nbsp; ] [ &nbsp;&nbsp; ]</div>
              </td>
              <td style={{ width: '47%', backgroundColor: '#f9f9f9', padding: '0' }}>{renderRotacoes()}</td>
              <td style={{ width: '40%', padding: '1px' }}>{renderPontosGrid()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderEscalacao = (time: TimeDb, isEquipeA: boolean) => (
    <div className="roster-wrapper" style={{ width: '50%', float: 'left' }}>
      <div className="section-title">EQUIPE {isEquipeA ? 'A' : 'B'}: {time.nome}</div>
      <table className="table-bordered table-sm">
        <thead>
          <tr>
            <th style={{ width: '15%' }}>Nº</th>
            <th>NOME DO JOGADOR</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }).map((_, i) => (
            <tr key={i}><td>&nbsp;</td><td>&nbsp;</td></tr>
          ))}
        </tbody>
      </table>
      <div className="libero-text">LÍBEROS:</div>
      <div style={{ display: 'flex', borderTop: '1px solid #000' }}>
        <div className="libero-text" style={{ flex: 1, padding: '2px', borderRight: '1px solid #000' }}>Nº ___</div>
        <div className="libero-text" style={{ flex: 1, padding: '2px' }}>Nº ___</div>
      </div>
      <div className="signature-box">Assinatura Capitão: ____________________</div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Botão de impressão nativo com a biblioteca */}
      <div className="no-print" style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
        <button onClick={() => handlePrint()} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
          🖨️ Imprimir Súmula Oficial
        </button>
      </div>

      {/* Container que será enviado para a impressora. Usa contentRef agora. */}
      <div ref={contentRef} className="cbv-container">
        
        {/* CABEÇALHO OFICIAL */}
        <div className="header-box">
          <div style={{ flex: 1, padding: '4px 8px', borderRight: '2px solid #000' }}>
            <h1 className="header-title">{regras?.nomeCampeonato || 'Campeonato de Voleibol'}</h1>
            <div className="header-info">
              <span><b>FASE:</b> {jogo.fase.toUpperCase()}</span>
              <span><b>JOGO Nº:</b> {jogo.ordem || jogo.numero || '-'}</span>
              <span><b>NAIPE:</b> [ ] M [ ] F</span>
            </div>
            <div className="header-info" style={{ marginTop: '2px' }}>
              <span><b>DATA:</b> ___/___/20__</span>
              <span><b>HORÁRIO OFICIAL:</b> {jogo.horario}</span>
              <span><b>CIDADE:</b> ___________________</span>
            </div>
          </div>
          <div className="header-logo">SÚMULA OFICIAL<br/>DE VOLEIBOL</div>
        </div>

        <div className="main-grid">
          
          {/* COLUNA ESQUERDA: SETS e SANÇÕES */}
          <div className="left-col">
            <div className="sets-container">
              {Array.from({ length: numeroSets }).map((_, i) => renderSetGrid(i + 1))}
            </div>
            
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <div className="roster-wrapper" style={{ width: '40%' }}>
                <div className="section-title">SANÇÕES</div>
                <table className="table-bordered table-sm sanctions-table">
                  <thead>
                    <tr>
                      <th title="Advertência">A</th>
                      <th title="Penalidade">P</th>
                      <th title="Expulsão">E</th>
                      <th title="Desqualificação">D</th>
                      <th>A/B</th>
                      <th>SET</th>
                      <th>PLACAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="roster-wrapper" style={{ width: '60%' }}>
                <div className="section-title">OBSERVAÇÕES</div>
                <div style={{ padding: '2px', height: '60px' }}></div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: ESCALAÇÕES E RESULTADOS */}
          <div className="right-col">
            <div style={{ overflow: 'hidden', marginBottom: '4px' }}>
              {renderEscalacao(jogo.timeA as TimeDb, true)}
              {renderEscalacao(jogo.timeB as TimeDb, false)}
            </div>

            <div className="roster-wrapper" style={{ marginBottom: '4px' }}>
              <div className="section-title">APROVAÇÃO (ARBITRAGEM)</div>
              <table className="table-bordered table-sm referee-table">
                <tbody>
                  <tr><td style={{ width: '60%' }}>1º Árbitro:</td><td>Assinatura:</td></tr>
                  <tr><td>2º Árbitro:</td><td>Assinatura:</td></tr>
                  <tr><td>Apontador:</td><td>Assinatura:</td></tr>
                  <tr><td>Juiz de Linha 1: ______________</td><td>Juiz 3: ______________</td></tr>
                  <tr><td>Juiz de Linha 2: ______________</td><td>Juiz 4: ______________</td></tr>
                </tbody>
              </table>
            </div>

            <div className="roster-wrapper" style={{ border: '2px solid #000' }}>
              <div className="section-title" style={{ backgroundColor: '#000', color: '#fff' }}>RESULTADOS</div>
              
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div className="result-team">{jogo.timeA.nome}</div>
                <div className="result-set">SET</div>
                <div className="result-team">{jogo.timeB.nome}</div>
              </div>

              <table className="table-bordered table-sm results-table" style={{ borderTop: 'none' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ width: '12%' }}>T</th>
                    <th style={{ width: '12%' }}>S</th>
                    <th style={{ width: '12%' }}>V</th>
                    <th style={{ width: '14%' }}>P</th>
                    <th style={{ width: '10%' }}>Nº</th>
                    <th style={{ width: '14%' }}>P</th>
                    <th style={{ width: '12%' }}>V</th>
                    <th style={{ width: '12%' }}>S</th>
                    <th style={{ width: '12%' }}>T</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasResultado.map((linha, i) => (
                    <tr key={i}>
                      <td></td><td></td>
                      <td style={{ fontWeight: 'bold' }}>{linha.vA}</td>
                      <td className="score-cell">{linha.pA}</td>
                      <td style={{ backgroundColor: '#e5e5e5', fontWeight: 'bold' }}>{i + 1}</td>
                      <td className="score-cell">{linha.pB}</td>
                      <td style={{ fontWeight: 'bold' }}>{linha.vB}</td>
                      <td></td><td></td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f9f9f9' }}>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '4px' }}>TOTAL</td>
                    <td style={{ fontWeight: 'bold' }}>{jogo.setsVencidosA || 0}</td>
                    <td style={{ fontWeight: 'bold' }}>{totalPtsA || 0}</td>
                    <td style={{ backgroundColor: '#000', color: '#fff', fontWeight: 'bold' }}>T</td>
                    <td style={{ fontWeight: 'bold' }}>{totalPtsB || 0}</td>
                    <td style={{ fontWeight: 'bold' }}>{jogo.setsVencidosB || 0}</td>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '4px' }}>TOTAL</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="winner-box">
                <b>VENCEDOR: </b> 
                {isFinalizado 
                  ? ((jogo.setsVencidosA || 0) > (jogo.setsVencidosB || 0) ? jogo.timeA.nome.toUpperCase() : jogo.timeB.nome.toUpperCase()) 
                  : '________________________________'}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: landscape; margin: 5mm; }
          .cbv-container { transform: scale(0.95); transform-origin: top left; }
        }
        
        .cbv-container { font-family: 'Arial', sans-serif; color: #000; font-size: 11px; background: #fff; width: 1040px; margin: 0 auto; box-sizing: border-box; border: 1px solid #000; padding: 6px; }
        
        .header-box { display: flex; border: 2px solid #000; margin-bottom: 6px; }
        .header-title { margin: 0 0 4px 0; font-size: 16px; text-transform: uppercase; }
        .header-info { font-size: 11px; display: flex; gap: 20px; }
        .header-logo { width: 180px; display: flex; align-items: center; justify-content: center; background-color: #e5e5e5; font-weight: 900; font-size: 14px; text-align: center; }

        .main-grid { display: flex; gap: 6px; }
        .left-col { width: 62%; }
        .right-col { width: 38%; }
        
        .sets-container { display: flex; flex-direction: column; gap: 4px; }
        
        .table-bordered { border-collapse: collapse; width: 100%; text-align: center; }
        .table-bordered th, .table-bordered td { border: 1px solid #000; padding: 2px; }
        .table-sm td, .table-sm th { padding: 1px !important; height: 14px; }
        
        .section-title { font-weight: bold; background-color: #e5e5e5; text-transform: uppercase; border-bottom: 1px solid #000; padding: 3px; text-align: center; font-size: 10px; }
        .set-wrapper { border: 2px solid #000; }
        .set-header { display: flex; justify-content: space-between; font-weight: bold; background-color: #e5e5e5; border-bottom: 1px solid #000; padding: 3px 6px; font-size: 10px; }
        .team-name { font-size: 10px; }
        .tempos-text { font-size: 9px; }
        
        .rotation-table { border-collapse: collapse; width: 100%; text-align: center; font-size: 7px; }
        .rotation-table td { border: 1px solid #000; padding: 1px; height: 11px; }
        
        .points-container { display: flex; flex-wrap: wrap; gap: 1px; padding: 2px; justify-content: flex-start; }
        .point-box { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #999; font-size: 7px; color: #333; font-weight: bold; }
        
        .roster-wrapper { border: 1px solid #000; }
        .libero-text { font-size: 9px; padding: 2px; border-top: 1px solid #000; }
        .signature-box { padding: 4px; border-top: 1px solid #000; font-size: 10px; font-weight: bold; text-align: center; }
        
        .referee-table { font-size: 10px; text-align: left; }
        .results-table { font-size: 10px; }
        .score-cell { font-size: 11px; font-weight: bold; }
        .result-team { flex: 1; text-align: center; font-size: 10px; font-weight: bold; border-right: 1px solid #000; padding: 3px; word-break: break-word; }
        .result-set { width: 30px; text-align: center; font-size: 10px; font-weight: bold; border-right: 1px solid #000; padding: 3px; }
        .winner-box { padding: 4px; text-align: center; font-size: 11px; border-top: 1px solid #000; background-color: #e5e5e5; }
      `}} />
    </div>
  );
}