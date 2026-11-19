'use client';

import { useEffect, useState, use, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '../../../../../supabase';
import { Partida, Regras, TimeDb } from '../../../../../types/torneio';

export default function SumulaOficial({ params }: { params: Promise<{ id: string, partidaId: string }> }) {
  const { id, partidaId } = use(params);

  const [jogo, setJogo] = useState<Partida | null>(null);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  
  const sumulaRef = useRef<HTMLDivElement>(null);

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
      
      const margin = 5;
      const pdfWidth = pdf.internal.pageSize.getWidth() - margin * 2; 
      const pdfHeight = pdf.internal.pageSize.getHeight() - margin * 2; 
      
      const canvasRatio = canvas.width / canvas.height;
      let renderWidth = pdfWidth;
      let renderHeight = pdfWidth / canvasRatio;

      if (renderHeight > pdfHeight) {
        renderHeight = pdfHeight;
        renderWidth = pdfHeight * canvasRatio;
      }
      
      const x = margin + (pdfWidth - renderWidth) / 2;
      const y = margin + (pdfHeight - renderHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
      pdf.save(`Sumula_${jogo?.timeA?.nome}_x_${jogo?.timeB?.nome}.pdf`);
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
  const isMd3 = (jogo.fase === 'grupos' ? regras?.formatoGrupos : regras?.formatoFinais)?.includes('melhor_de_3');
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

  const renderSetGrid = (numSet: number) => (
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

  const renderEscalacao = (time: TimeDb, isEquipeA: boolean) => (
    <div className="roster-wrapper">
      <div className="section-title">EQUIPE {isEquipeA ? 'A' : 'B'}: {time.nome}</div>
      <table className="table-bordered table-sm">
        <thead>
          <tr><th style={{ width: '15%' }}>Nº</th><th>NOME DO JOGADOR</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }).map((_, i) => <tr key={i}><td>&nbsp;</td><td>&nbsp;</td></tr>)}
        </tbody>
      </table>
      <div style={{ fontSize: '10px', padding: '4px', borderTop: '1px solid #000' }}>LÍBEROS:</div>
      <div style={{ display: 'flex', borderTop: '1px solid #000' }}>
        <div style={{ flex: 1, padding: '4px', borderRight: '1px solid #000' }}>Nº ___</div>
        <div style={{ flex: 1, padding: '4px' }}>Nº ___</div>
      </div>
      <div style={{ padding: '6px', borderTop: '1px solid #000', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
        Assinatura Capitão: ____________________
      </div>
    </div>
  );

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
              <span><b>
