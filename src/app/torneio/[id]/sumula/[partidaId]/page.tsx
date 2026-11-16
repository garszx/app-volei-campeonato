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

  // FUNÇÃO MÁGICA: Gera o PDF como uma imagem perfeita, ignorando o navegador
  const baixarPDF = async () => {
    if (!sumulaRef.current) return;
    setGerandoPDF(true);
    try {
      const canvas = await html2canvas(sumulaRef.current, {
        scale: 2, // Aumenta a qualidade da imagem
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Sumula_${jogo?.timeA?.nome}_x_${jogo?.timeB?.nome}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Ocorreu um erro ao gerar o PDF.");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (carregando) return <div style={{ padding: '2rem', textAlign: 'center', color: '#000' }}>A carregar súmula...</div>;
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

  const renderPontosGrid = () => (
    <div className="points-container">
      {Array.from({ length: 40 }).map((_, i) => <span key={i} className="point-box">{i + 1}</span>)}
    </div>
  );

  const renderRotacoes = () => (
    <table className="rotation-table">
      <tbody>
        <tr style={{ backgroundColor: '#e5e5e5' }}>
          <td style={{ width: '22%', fontWeight: 'bold' }}>ORDEM</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>I</td><td style={{ width: '13%', fontWeight: 'bold' }}>II</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>III</td><td style={{ width: '13%', fontWeight: 'bold' }}>IV</td>
          <td style={{ width: '13%', fontWeight: 'bold' }}>V</td><td style={{ width: '13%', fontWeight: 'bold' }}>VI</td>
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
      <table className="table-bordered" style={{ borderTop: 'none', width: '100%', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ width: '13%', borderTop: 'none', verticalAlign: 'top', padding: '4px' }}>
              <div className="team-name">{jogo.timeA.nome}</div>
              <div className="tempos-text">Tempos:<br/>[ &nbsp;&nbsp; ] [ &nbsp;&nbsp; ]</div>
            </td>
            <td style={{ width: '47%', backgroundColor: '#f9f9f9', padding: '0', borderTop: 'none', verticalAlign: 'top' }}>{renderRotacoes()}</td>
            <td style={{ width: '40%', padding: '2px', borderTop: 'none', verticalAlign: 'top' }}>{renderPontosGrid()}</td>
          </tr>
          <tr>
            <td style={{ width: '13%', verticalAlign: 'top', padding: '4px' }}>
              <div className="team-name">{jogo.timeB.nome}</div>
              <div className="tempos-text">Tempos:<br/>[ &nbsp;&nbsp; ] [ &nbsp;&nbsp; ]</div>
            </td>
            <td style={{ width: '47%', backgroundColor: '#f9f9f9', padding: '0', verticalAlign: 'top' }}>{renderRotacoes()}</td>
            <td style={{ width: '40%', padding: '2px', verticalAlign: 'top' }}>{renderPontosGrid()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderEscalacao = (time: TimeDb, isEquipeA: boolean) => (
    <div className="roster-wrapper" style={{ width: '49%' }}>
      <div className="section-title">EQUIPE {isEquipeA ? 'A' : 'B'}: {time.nome}</div>
      <table className="table-bordered table-sm" style={{ width: '100%' }}>
        <thead><tr><th style={{ width: '15%' }}>Nº</th><th>NOME DO JOGADOR</th></tr></thead>
        <tbody>{Array.from({ length: 12 }).map((_, i) => <tr key={i}><td>&nbsp;</td><td>&nbsp;</td></tr>)}</tbody>
      </table>
      <div className="libero-text">LÍBEROS:</div>
      <div style={{ display: 'flex', borderTop: '1px solid #000' }}>
        <div className="libero-text" style={{ flex: 1, borderRight: '1px solid #000' }}>Nº ___</div>
        <div className="libero-text" style={{ flex: 1 }}>Nº ___</div>
      </div>
      <div className="signature-box">Assinatura Capitão: ____________________</div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#e2e8f0', minHeight: '100vh', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Botão para Gerar o PDF (agora baixa o arquivo direto) */}
      <div style={{ textAlign: 'center', marginBottom: '1rem', width: '100%' }}>
        <button 
          onClick={baixarPDF} 
          disabled={gerandoPDF}
          style={{ padding: '12px 24px', backgroundColor: gerandoPDF ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          {gerandoPDF ? '⏳ A gerar documento...' : '📥 Descarregar Súmula Oficial (PDF)'}
        </button>
      </div>

      {/* Container Fixo: O tamanho 1123x794 é a proporção exata do A4 em pixels. */}
      <div ref={sumulaRef} className="cbv-container" style={{ width: '1123px', height: '794px', backgroundColor: '#fff', padding: '12px', border: '1px solid #000', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', color: '#000', display: 'flex', flexDirection: 'column' }}>
        
        {/* CABEÇALHO OFICIAL */}
        <div style={{ display: 'flex', border: '2px solid #000', marginBottom: '8px', flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '8px 12px', borderRight: '2px solid #000' }}>
            <h1 style={{ margin: '0 0 4px 0', fontSize: '18px', textTransform: 'uppercase' }}>{regras?.nomeCampeonato || 'Campeonato de Voleibol'}</h1>
            <div style={{ fontSize: '12px', display: 'flex', gap: '24px' }}>
              <span><b>FASE:</b> {jogo.fase.toUpperCase()}</span><span><b>JOGO Nº:</b> {jogo.ordem || jogo.numero || '-'}</span><span><b>NAIPE:</b> [ ] M [ ] F</span>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', gap: '24px', marginTop: '4px' }}>
              <span><b>DATA:</b> ___/___/20__</span><span><b>HORÁRIO OFICIAL:</b> {jogo.horario}</span><span><b>CIDADE:</b> ___________________</span>
            </div>
          </div>
          <div style={{ width: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e5e5', fontWeight: '900', fontSize: '16px', textAlign: 'center' }}>
            SÚMULA OFICIAL<br/>DE VOLEIBOL
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flex: 1, overflow: 'hidden' }}>
          {/* COLUNA ESQUERDA: SETS e SANÇÕES */}
          <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {Array.from({ length: numeroSets }).map((_, i) => renderSetGrid(i + 1))}
            </div>
            
            <div style={{ display: 'flex', gap: '6px', height: '110px', flexShrink: 0 }}>
              <div className="roster-wrapper" style={{ width: '40%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="section-title">SANÇÕES</div>
                <table className="table-bordered table-sm" style={{ height: '100%' }}>
                  <thead><tr><th>A</th><th>P</th><th>E</th><th>D</th><th>A/B</th><th>SET</th><th>PLACAR</th></tr></thead>
                  <tbody>{Array.from({ length: 4 }).map((_, i) => <tr key={i}><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>)}</tbody>
                </table>
              </div>
              <div className="roster-wrapper" style={{ width: '60%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="section-title">OBSERVAÇÕES</div>
                <div style={{ flex: 1 }}></div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: ESCALAÇÕES E RESULTADOS */}
          <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
              {renderEscalacao(jogo.timeA as TimeDb, true)}
              {renderEscalacao(jogo.timeB as TimeDb, false)}
            </div>

            <div className="roster-wrapper" style={{ flexShrink: 0 }}>
              <div className="section-title">APROVAÇÃO (ARBITRAGEM)</div>
              <table className="table-bordered table-sm" style={{ textAlign: 'left', width: '100%' }}>
                <tbody>
                  <tr><td style={{ width: '60%', paddingLeft: '4px' }}>1º Árbitro:</td><td style={{ paddingLeft: '4px' }}>Assinatura:</td></tr>
                  <tr><td style={{ paddingLeft: '4px' }}>2º Árbitro:</td><td style={{ paddingLeft: '4px' }}>Assinatura:</td></tr>
                  <tr><td style={{ paddingLeft: '4px' }}>Apontador:</td><td style={{ paddingLeft: '4px' }}>Assinatura:</td></tr>
                  <tr><td style={{ paddingLeft: '4px' }}>Juiz de Linha 1: ________________</td><td style={{ paddingLeft: '4px' }}>Juiz 3: ________________</td></tr>
                  <tr><td style={{ paddingLeft: '4px' }}>Juiz de Linha 2: ________________</td><td style={{ paddingLeft: '4px' }}>Juiz 4: ________________</td></tr>
                </tbody>
              </table>
            </div>

            <div className="roster-wrapper" style={{ border: '2px solid #000', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="section-title" style={{ backgroundColor: '#000', color: '#fff' }}>RESULTADOS</div>
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 'bold', padding: '4px', borderRight: '1px solid #000' }}>{jogo.timeA.nome}</div>
                <div style={{ width: '30px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', padding: '4px', borderRight: '1px solid #000' }}>SET</div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 'bold', padding: '4px' }}>{jogo.timeB.nome}</div>
              </div>

              <table className="table-bordered table-sm" style={{ borderTop: 'none', flex: 1 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0', fontSize: '11px' }}>
                    <th style={{ width: '12%' }}>T</th><th style={{ width: '12%' }}>S</th><th style={{ width: '12%' }}>V</th><th style={{ width: '14%' }}>P</th>
                    <th style={{ width: '10%' }}>Nº</th>
                    <th style={{ width: '14%' }}>P</th><th style={{ width: '12%' }}>V</th><th style={{ width: '12%' }}>S</th><th style={{ width: '12%' }}>T</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '12px' }}>
                  {linhasResultado.map((linha, i) => (
                    <tr key={i}>
                      <td></td><td></td><td style={{ fontWeight: 'bold' }}>{linha.vA}</td><td style={{ fontWeight: 'bold', fontSize: '14px' }}>{linha.pA}</td>
                      <td style={{ backgroundColor: '#e5e5e5', fontWeight: 'bold' }}>{i + 1}</td>
                      <td style={{ fontWeight: 'bold', fontSize: '14px' }}>{linha.pB}</td><td style={{ fontWeight: 'bold' }}>{linha.vB}</td><td></td><td></td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f9f9f9' }}>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '4px' }}>TOTAL</td>
                    <td style={{ fontWeight: 'bold' }}>{jogo.setsVencidosA || 0}</td><td style={{ fontWeight: 'bold' }}>{totalPtsA || 0}</td>
                    <td style={{ backgroundColor: '#000', color: '#fff', fontWeight: 'bold' }}>T</td>
                    <td style={{ fontWeight: 'bold' }}>{totalPtsB || 0}</td><td style={{ fontWeight: 'bold' }}>{jogo.setsVencidosB || 0}</td>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '4px' }}>TOTAL</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ padding: '6px', textAlign: 'center', fontSize: '12px', borderTop: '1px solid #000', backgroundColor: '#e5e5e5' }}>
                <b>VENCEDOR: </b> {isFinalizado ? ((jogo.setsVencidosA || 0) > (jogo.setsVencidosB || 0) ? jogo.timeA.nome.toUpperCase() : jogo.timeB.nome.toUpperCase()) : '________________________________'}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .table-bordered { border-collapse: collapse; }
        .table-bordered th, .table-bordered td { border: 1px solid #000; }
        .table-sm td, .table-sm th { height: 16px; }
        
        .section-title { font-weight: bold; background-color: #e5e5e5; text-transform: uppercase; border-bottom: 1px solid #000; padding: 4px; text-align: center; font-size: 11px; }
        .set-wrapper { border: 2px solid #000; display: flex; flex-direction: column; height: 165px; }
        .set-header { display: flex; justify-content: space-between; font-weight: bold; background-color: #e5e5e5; border-bottom: 1px solid #000; padding: 4px 8px; font-size: 11px; }
        .team-name { font-size: 12px; font-weight: bold; margin-bottom: 4px; word-break: break-word; }
        .tempos-text { font-size: 10px; line-height: 1.4; }
        
        .rotation-table { border-collapse: collapse; width: 100%; text-align: center; font-size: 9px; table-layout: fixed; }
        .rotation-table td { border: 1px solid #000; height: 16px; }
        
        .points-container { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; padding: 4px; align-items: start; }
        .point-box { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid #666; font-size: 9px; color: #000; font-weight: bold; }
        
        .roster-wrapper { border: 1px solid #000; background: #fff; }
        .libero-text { font-size: 10px; padding: 4px; font-weight: bold; }
        .signature-box { padding: 6px; border-top: 1px solid #000; font-size: 11px; font-weight: bold; text-align: center; }
      `}} />
    </div>
  );
}