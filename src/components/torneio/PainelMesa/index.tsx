import Image from 'next/image';
import { FormEvent } from 'react';
import { Partida, Regras, TimeDb, Time } from '../../../types/torneio';
import styles from './PainelMesa.module.css';

interface PainelMesaProps {
  abaAtiva: string; urlAtual: string;
  nivelAcesso: 'visitante' | 'mesario' | 'mestre';
  senha: string; setSenha: (s: string) => void;
  handleLogin: (e: FormEvent) => void; fazerLogout: () => void;
  statusTorneio: string; regras: Regras | null;
  mostrarEditorEquipes: boolean; setMostrarEditorEquipes: (v: boolean) => void;
  timesMap: Record<string, TimeDb>; timesBase: Time[]; partidas: Partida[];
  jogoAtual: Partida | undefined; proximoJogo: Partida | undefined; isInvertido: boolean;
  
  // Ações
  atualizarNomeEquipe: (id: string, nome: string) => void;
  handleUploadLogoGlobal: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  atualizarChaveEquipe: (id: string, chave: string) => void;
  atualizarPlacar: (id: string, time: 'A'|'B', valor: number) => void;
  encerrarAcao: (jogo: Partida) => void; iniciarPartida: (id: string) => void;
  gerarSemifinais: () => void; gerarFinalDireta: () => void;
  encerrarCampeonatoPontosCorridos: () => void; gerarFinais: () => void;
  baixarQRCode: () => void; compartilharLink: () => void; gerarRelatorioELimpar: () => void;
  
  // Estados de Edição
  partidaEditando: string | null; setPartidaEditando: (id: string | null) => void;
  abrirEdicao: (p: Partida) => void; salvarEdicao: (id: string) => void;
  editPontosA: number; setEditPontosA: (v: number) => void;
  editPontosB: number; setEditPontosB: (v: number) => void;
  editSetsA: number; setEditSetsA: (v: number) => void;
  editSetsB: number; setEditSetsB: (v: number) => void;
  editMestreTimeA: string; setEditMestreTimeA: (v: string) => void;
  editMestreTimeB: string; setEditMestreTimeB: (v: string) => void;
  editMestreStatus: string; setEditMestreStatus: (v: string) => void;
  editHorario: string; setEditHorario: (v: string) => void;
}

export default function PainelMesa(props: PainelMesaProps) {
  if (props.abaAtiva !== 'admin') return null;
  const { nivelAcesso, regras, statusTorneio, timesMap, partidas, jogoAtual, proximoJogo, isInvertido } = props;
  const isMd3Geral = regras?.formatoGrupos?.includes('melhor_de_3') || regras?.formatoFinais?.includes('melhor_de_3');
  
  const tA_UI = isInvertido && jogoAtual ? jogoAtual.timeB : jogoAtual?.timeA;
  const tB_UI = isInvertido && jogoAtual ? jogoAtual.timeA : jogoAtual?.timeB;
  const ptsA_UI = isInvertido && jogoAtual ? jogoAtual.pontosB : jogoAtual?.pontosA;
  const ptsB_UI = isInvertido && jogoAtual ? jogoAtual.pontosA : jogoAtual?.pontosB;
  const tagLeft = isInvertido ? 'B' : 'A';
  const tagRight = isInvertido ? 'A' : 'B';

  if (nivelAcesso === 'visitante') {
    return (
      <div className={styles.hideOnPrint}>
        <form onSubmit={props.handleLogin} className={styles.loginBox}>
          <h2 className={styles.adminWarningTitle}>🔒 Acesso Restrito</h2>
          <input type="password" placeholder="Senha da Mesa ou Mestre" className={styles.input} value={props.senha} onChange={(e) => props.setSenha(e.target.value)} />
          <button type="submit" className={styles.btnPrimary}>Acessar</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.hideOnPrint}>
      {/* CABEÇALHO */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '22px', color: nivelAcesso === 'mestre' ? '#ef4444' : '#38bdf8' }}>Painel da Mesa {nivelAcesso === 'mestre' ? '👑 (Modo Mestre)' : '📋 (Modo Mesário)'}</h2>
        <button onClick={props.fazerLogout} style={{ padding: '6px 16px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Sair</button>
      </div>

      {/* EDITOR GLOBAL */}
      {nivelAcesso === 'mestre' && statusTorneio !== 'aguardando_sorteio' && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => props.setMostrarEditorEquipes(!props.mostrarEditorEquipes)} style={{ width: '100%', maxWidth: '500px', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
              {props.mostrarEditorEquipes ? '❌ Fechar Editor Global' : '🛠️ Abrir Editor Global (Nomes, Logos e Chaves)'}
            </button>
          </div>
          {props.mostrarEditorEquipes && (
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px', marginTop: '10px' }}>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>Altere aqui para atualizar automaticamente em toda a tabela.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                {Object.values(timesMap).map(t => (
                  <div key={t.id} style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {regras?.mostrarLogos && <Image src={t.escudoUrl} alt="Logo" width={40} height={40} style={{ objectFit: 'contain', backgroundColor: 'white', borderRadius: '50%' }} />}
                      <input type="text" defaultValue={t.nome} onBlur={(e) => props.atualizarNomeEquipe(t.id, e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '4px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {regras?.mostrarLogos ? ( <input type="file" accept="image/*" onChange={(e) => props.handleUploadLogoGlobal(t.id, e)} style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '130px' }} /> ) : <div />}
                      <select value={t.chave || 'U'} onChange={(e) => props.atualizarChaveEquipe(t.id, e.target.value)} style={{ padding: '6px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                        <option value="U">🏆 Chave Única</option><option value="A">🅰️ Grupo A</option><option value="B">🅱️ Grupo B</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTROLE DA PARTIDA ATUAL */}
      {jogoAtual && tA_UI && tB_UI ? (
        <div className={styles.card}>
          <h2 className={styles.adminGameTitle}>Jogo em Andamento - {jogoAtual.horario}</h2>
          {isInvertido && <span style={{display: 'block', textAlign: 'center', backgroundColor: '#f59e0b', color: 'black', fontWeight: 'bold', padding: '5px', borderRadius: '8px', marginBottom: '10px', fontSize: '12px'}}>LADOS INVERTIDOS (FIVB)</span>}
          <div className={styles.textCenter}><h3 className={styles.adminSetsTitle}>Sets: {jogoAtual.setsVencidosA || 0} x {jogoAtual.setsVencidosB || 0}</h3></div>
          
          <div className={styles.scoreBoard}>
            <div className={styles.teamColAdmin}><h3>{tA_UI.nome}</h3><span className={styles.scoreText}>{ptsA_UI}</span><div className={styles.controls}><button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => props.atualizarPlacar(jogoAtual.id, tagLeft, -1)}>-</button><button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => props.atualizarPlacar(jogoAtual.id, tagLeft, 1)}>+</button></div></div>
            <h2 className={styles.adminVsText}>X</h2>
            <div className={styles.teamColAdmin}><h3>{tB_UI.nome}</h3><span className={styles.scoreText}>{ptsB_UI}</span><div className={styles.controls}><button className={`${styles.btnScore} ${styles.btnMinus}`} onClick={() => props.atualizarPlacar(jogoAtual.id, tagRight, -1)}>-</button><button className={`${styles.btnScore} ${styles.btnPlus}`} onClick={() => props.atualizarPlacar(jogoAtual.id, tagRight, 1)}>+</button></div></div>
          </div>
          <button className={styles.btnEnd} onClick={() => props.encerrarAcao(jogoAtual)}>Encerrar Set/Partida</button>
        </div>
      ) : proximoJogo ? (
        <div className={`${styles.card} ${styles.textCenter}`}><h2>Próxima Partida: {proximoJogo.horario}</h2><h3 className={styles.adminNextGameMatch}>{proximoJogo.timeA.nome} X {proximoJogo.timeB.nome}</h3><button className={styles.btnPrimary} onClick={() => props.iniciarPartida(proximoJogo.id)}>Iniciar Jogo</button></div>
      ) : statusTorneio === 'fase_grupos' ? (
        <div className={`${styles.card} ${styles.textCenter}`}>
          <h2 style={{ marginBottom: '20px' }}>Fase de Grupos Encerrada!</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {props.timesBase.length >= 4 && ( <button className={styles.btnPrimary} onClick={props.gerarSemifinais}>🏆 Avançar para Semifinais</button> )}
            {props.timesBase.length >= 3 && ( <button className={styles.btnPrimary} style={{ backgroundColor: '#3b82f6' }} onClick={props.gerarFinalDireta}>🥇 Gerar Grande Final Direta (1º x 2º)</button> )}
            <button className={styles.btnPrimary} style={{ backgroundColor: '#f59e0b' }} onClick={props.encerrarCampeonatoPontosCorridos}>🛑 Encerrar e Coroar Campeão</button>
          </div>
        </div>
      ) : statusTorneio === 'semifinais' ? (
        <div className={`${styles.card} ${styles.textCenter}`}><h2>Semifinais Encerradas!</h2><button className={`${styles.btnPrimary} ${styles.btnWarning}`} onClick={props.gerarFinais}>Gerar Final</button></div>
      ) : null}

      {/* EDITOR DE PARTIDAS (MESA) */}
      <div className={styles.card} style={{ marginTop: '20px', borderColor: nivelAcesso === 'mestre' ? '#ef4444' : '#334155' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>{nivelAcesso === 'mestre' ? '👑 MODO MESTRE: Editar Qualquer Partida' : '✏️ Editar Partidas Finalizadas'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {partidas.filter(p => nivelAcesso === 'mestre' ? true : p.status === 'finalizado').map(p => (
            <div key={p.id} style={{ border: `1px solid ${nivelAcesso === 'mestre' ? '#ef4444' : '#334155'}`, padding: '10px', borderRadius: '8px', background: '#0f172a' }}>
              {props.partidaEditando === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {nivelAcesso === 'mestre' && (
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px'}}>
                          <input type="time" value={props.editHorario} onChange={e => props.setEditHorario(e.target.value)} style={{padding: '5px', borderRadius: '4px', backgroundColor: '#334155', color: '#38bdf8', border: '1px solid #38bdf8', outline: 'none', fontWeight: 'bold'}} />
                          <select value={props.editMestreStatus} onChange={e => props.setEditMestreStatus(e.target.value)} style={{padding: '5px', borderRadius: '4px', backgroundColor: '#334155', color: 'white', border: 'none', outline: 'none'}}>
                              <option value="pendente">Status: Pendente</option><option value="em_andamento">Status: Em Andamento</option><option value="finalizado">Status: Finalizado</option>
                          </select>
                      </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.textCenter} style={{ flex: 1 }}>
                      {nivelAcesso === 'mestre' ? (
                          <select value={props.editMestreTimeA} onChange={e => props.setEditMestreTimeA(e.target.value)} style={{width: '90%', padding: '5px', marginBottom: '5px', borderRadius: '4px'}}>
                              {Object.values(timesMap).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                      ) : ( <p className={styles.boldText}>{p.timeA.nome}</p> )}
                      <br/><label style={{ fontSize: '12px', color: '#94a3b8' }}>Pontos</label><br/>
                      <input type="number" value={props.editPontosA} onChange={e => props.setEditPontosA(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} />
                      {isMd3Geral && <><br/><label style={{ fontSize: '12px', color: '#94a3b8' }}>Sets</label><br/><input type="number" value={props.editSetsA} onChange={e => props.setEditSetsA(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px' }} /></>}
                    </div>
                    <span style={{ fontWeight: 'bold', color: '#475569' }}>X</span>
                    <div className={styles.textCenter} style={{ flex: 1 }}>
                      {nivelAcesso === 'mestre' ? (
                          <select value={props.editMestreTimeB} onChange={e => props.setEditMestreTimeB(e.target.value)} style={{width: '90%', padding: '5px', marginBottom: '5px', borderRadius: '4px'}}>
                              {Object.values(timesMap).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                      ) : ( <p className={styles.boldText}>{p.timeB.nome}</p> )}
                      <br/><label style={{ fontSize: '12px', color: '#94a3b8' }}>Pontos</label><br/>
                      <input type="number" value={props.editPontosB} onChange={e => props.setEditPontosB(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} />
                      {isMd3Geral && <><br/><label style={{ fontSize: '12px', color: '#94a3b8' }}>Sets</label><br/><input type="number" value={props.editSetsB} onChange={e => props.setEditSetsB(Number(e.target.value))} style={{ width: '60px', textAlign: 'center', padding: '5px', borderRadius: '4px' }} /></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                    <button onClick={() => props.setPartidaEditando(null)} style={{ padding: '8px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => props.salvarEdicao(p.id)} style={{ padding: '8px 16px', background: nivelAcesso === 'mestre' ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Salvar Modo {nivelAcesso === 'mestre' ? 'Mestre' : 'Correção'}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#94a3b8' }}>Jogo {p.id.split('_')[1]} {p.status !== 'finalizado' && `(${p.status})`}</span>
                  <span className={styles.boldText}>{p.timeA.nome} {p.pontosA} x {p.pontosB} {p.timeB.nome}</span>
                  <button onClick={() => props.abrirEdicao(p)} style={{ padding: '4px 10px', background: nivelAcesso === 'mestre' ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>✏️ Editar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* COMPARTILHAR */}
      <div className={styles.card} style={{ marginTop: '20px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '15px' }}>📲 Compartilhar Torneio</h3>
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(props.urlAtual)}`} alt="QR Code" width={250} height={250} style={{ display: 'block' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={props.baixarQRCode} className={styles.btnPrimary} style={{ maxWidth: '200px', backgroundColor: '#475569' }}>📥 Baixar QR Code</button>
          <button onClick={props.compartilharLink} className={styles.btnPrimary} style={{ maxWidth: '200px' }}>🔗 Enviar Link</button>
        </div>
      </div>
      
      {/* DANGER ZONE */}
      <div className={styles.dangerZone}>
        <h3 className={styles.dangerTitle}>Gerar Relatório e Encerrar</h3>
        <p className={styles.dangerDesc}>Salve o PDF deste campeonato e limpe o banco de dados.</p>
        <button className={styles.btnDanger} onClick={props.gerarRelatorioELimpar}>🖨️ Salvar PDF e Excluir Torneio</button>
      </div>
    </div>
  );
}