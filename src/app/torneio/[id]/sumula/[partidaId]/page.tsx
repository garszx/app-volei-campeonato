'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '../../../../../supabase';
import { Partida, Regras, TimeDb } from '../../../../../types/torneio';

export default function SumulaOficial({ params }: { params: Promise<{ id: string, partidaId: string }> }) {
  const { id, partidaId } = use(params);

  const [jogo, setJogo] = useState<Partida | null>(null);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [carregando, setCarregando] = useState(true);

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
        <tr>
          <td>INICIAL</td>
          {Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}
        </tr>
        <tr>
          <td>SUBSTITUTO</td>
          {Array.from({ length: 6 }).map((_, i) => <td key={i}></td>)}
        </tr>
        <tr>
          <td>PLACAR (IN)</td>
          {Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}
        </tr>
        <tr>
          <td>PLACAR (OUT)</td>
          {Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#666' }}>:</td>)}
        </tr>
        <tr>
          <td>SAQUE 1</td>
          {Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#999' }}>[ ]</td>)}
        </tr>
        <tr>
          <td>SAQUE 2</td>
          {Array.from({ length: 6 }).map((_, i) => <td key={i} style={{ color: '#999' }}>[ ]</td>)}
        </tr>
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
      <table className="table-bordered" style={{ borderTop: 'none' }}>
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
    <div className="cbv-page">
      <div className="no-print" style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <button onClick={() => window.print()} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
          🖨️ Imprimir Súmula Oficial
        </button>
      </div>

      <div className="cbv-container">
        {/* CABEÇALHO OFICIAL */}
        <div className="header-box">
          <div style={{ flex: 1, padding: '10px', borderRight: '2px solid #000' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '18px', textTransform: 'uppercase' }}>{regras?.nomeCampeonato || 'Campeonato de Voleibol'}</h1>
            <div style={{ fontSize: '12px', display: 'flex', gap: '20px' }}>
              <span><b>FASE:</b> {jogo.fase.toUpperCase()}</span>
              <span><b>JOGO Nº:</b> {jogo.ordem || jogo.numero || '-'}</span>
              <span><b>NAIPE:</b> [ ] M [ ] F</span>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', gap: '20px', marginTop: '6px' }}>
              <span><b>DATA:</b> ___/___/20__</span>
              <span><b>HORÁRIO OFICIAL:</b> {jogo.horario}</span>
              <span><b>CIDADE:</b> ___________________</span>
            </div>
          </div>
          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e5e5', fontWeight: '900', fontSize: '16px', textAlign: 'center' }}>
            SÚMULA OFICIAL<br/>DE VOLEIBOL
          </div>
        </div>

        <div className="main-grid">
          {/* COLUNA ESQUERDA: SETS */}
          <div className="left-col">
            {Array.from({ length: numeroSets }).map((_, i) => renderSetGrid(i + 1))}
            
            {/* LINHA DE SANÇÕES E OBSERVAÇÕES */}
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <div className="roster-wrapper" style={{ flex: 1.2 }}>
                <div className="section-title">SANÇÕES</div>
                <table className="table-bordered table-sm" style={{ fontSize: '10px' }}>
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
                      <tr key={i}>
                        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="roster-wrapper" style={{ flex: 2 }}>
                <div className="section-title">OBSERVAÇÕES</div>
                <div style={{ height: '78px', padding: '4px', fontSize: '11px', lineHeight: '16px', borderBottom: '1px solid #ccc' }}>
                  <br/><br/><br/><br/>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: ESCALAÇÕES E RESULTADOS */}
          <div className="right-col">
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ flex: 1 }}>{renderEscalacao(jogo.timeA as TimeDb, true)}</div>
              <div style={{ flex: 1 }}>{renderEscalacao(jogo.timeB as TimeDb, false)}</div>
            </div>

            {/* CAIXA DE APROVAÇÃO / ARBITRAGEM COMPLETA */}
            <div className="roster-wrapper" style={{ marginTop: '5px' }}>
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

            {/* CAIXA DE RESULTADOS (Padrão CBV) */}
            <div className="roster-wrapper" style={{ marginTop: '5px', border: '2px solid #000' }}>
              <div className="section-title" style={{ backgroundColor: '#000', color: '#fff' }}>RESULTADOS</div>
              
              <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 'bold', borderRight: '1px solid #000', padding: '4px', wordBreak: 'break-word' }}>{jogo.timeA.nome}</div>
                <div style={{ width: '35px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', borderRight: '1px solid #000', padding: '4px' }}>SET</div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', fontWeight: 'bold', padding: '4px', wordBreak: 'break-word' }}>{jogo.timeB.nome}</div>
              </div>

              <table className="table-bordered table-sm" style={{ fontSize: '11px', borderTop: 'none' }}>
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
                      <td></td>
                      <td></td>
                      <td style={{ fontWeight: 'bold' }}>{linha.vA}</td>
                      <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{linha.pA}</td>
                      <td style={{ backgroundColor: '#e5e5e5', fontWeight: 'bold' }}>{i + 1}</td>
                      <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{linha.pB}</td>
                      <td style={{ fontWeight: 'bold' }}>{linha.vB}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f9f9f9' }}>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '4px' }}>TOTAL</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{jogo.setsVencidosA || 0}</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{totalPtsA || 0}</td>
                    <td style={{ backgroundColor: '#000', color: '#fff', fontWeight: 'bold' }}>T</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{totalPtsB || 0}</td>
                    <td style={{ fontWeight: 'bold', fontSize: '12px' }}>{jogo.setsVencidosB || 0}</td>
                    <td colSpan={2} style={{ fontWeight: 'bold', textAlign: 'left', paddingLeft: '4px' }}>TOTAL</td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{ padding: '8px', textAlign: 'center', fontSize: '12px', borderTop: '1px solid #000', backgroundColor: '#e5e5e5' }}>
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
          @page { size: landscape A4; margin: 8mm; }
          .no-print { display: none !important; }
          body, html { background-color: #ffffff !important; margin: 0; padding: 0; }
          .cbv-page { padding: 0 !important; background: #fff !important; }
        }
        
        .cbv-page { background-color: #f1f5f9; min-height: 100vh; padding: 2rem; display: flex; flex-direction: column; align-items: center; }
        .cbv-container { font-family: 'Arial', sans-serif; color: #000; font-size: 11px; background: #fff; width: 100%; max-width: 1150px; margin: 0 auto; box-sizing: border-box; border: 1px solid #000; padding: 8px; }
        
        .header-box { display: flex; border: 2px solid #000; margin-bottom: 8px; }
        .main-grid { display: flex; gap: 8px; }
        .left-col { flex: 1.6; display: flex; flex-direction: column; gap: 8px; }
        .right-col { flex: 1; display: flex; flex-direction: column; }
        
        .table-bordered { border-collapse: collapse; width: 100%; text-align: center; }
        .table-bordered th, .table-bordered td { border: 1px solid #000; padding: 3px; }
        .table-sm td, .table-sm th { padding: 2px !important; height: 18px; }
        
        .section-title { font-weight: bold; background-color: #e5e5e5; text-transform: uppercase; border-bottom: 1px solid #000; padding: 4px; text-align: center; font-size: 11px; }
        .set-wrapper { border: 2px solid #000; }
        .set-header { display: flex; justify-content: space-between; font-weight: bold; background-color: #e5e5e5; border-bottom: 1px solid #000; padding: 4px 8px; font-size: 11px; }
        
        .rotation-table { border-collapse: collapse; width: 100%; text-align: center; font-size: 8px; }
        .rotation-table td { border: 1px solid #000; padding: 1px; height: 14px; }
        
        .points-container { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px; justify-content: flex-start; }
        .point-box { width: 15px; height: 15px; display: flex; align-items: center; justify-content: center; border: 1px solid #999; font-size: 8px; color: #333; font-weight: bold; }
        
        .roster-wrapper { border: 1px solid #000; }
      `}} />
    </div>
  );
}