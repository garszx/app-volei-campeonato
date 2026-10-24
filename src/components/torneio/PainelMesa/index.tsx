import Image from 'next/image';
import { FormEvent, useState } from 'react';
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
  
  atualizarNomeEquipe: (id: string, nome: string) => void;
  handleUploadLogoGlobal: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  atualizarChaveEquipe: (id: string, chave: string) => void;
  atualizarPlacar: (id: string, time: 'A'|'B', valor: number) => void;
  encerrarAcao: (jogo: Partida) => void; iniciarPartida: (id: string) => void;
  gerarSemifinais: () => void; gerarFinalDireta: () => void;
  encerrarCampeonatoPontosCorridos: () => void; gerarFinais: () => void;
  baixarQRCode: () => void; compartilharLink: () => void; gerarRelatorioELimpar: () => void;
  
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
  editParciais: string; setEditParciais: (v: string) => void;
}

export default function PainelMesa(props: PainelMesaProps) {
  const [cooldownBotao, setCooldownBotao] = useState(false);

  if (props.abaAtiva !== 'admin') return null;
  const { nivelAcesso, regras, statusTorneio, timesMap, partidas, jogoAtual, proximoJogo, isInvertido } = props;
  const isMd3Geral = regras?.formatoGrupos?.includes('melhor_de_3') || regras?.formatoFinais?.includes('melhor_de_3');
  
  const tA_UI = isInvertido && jogoAtual ? jogoAtual.timeB : jogoAtual?.timeA;
  const tB_UI = isInvertido && jogoAtual ? jogoAtual.timeA : jogoAtual?.timeB;
  const ptsA_UI = isInvertido && jogoAtual ? jogoAtual.pontosB : jogoAtual?.pontosA;
  const ptsB_UI = isInvertido && jogoAtual ? jogoAtual.pontosA : jogoAtual?.pontosB;
  const setsA_UI = isInvertido && jogoAtual ? jogoAtual.setsVencidosB : jogoAtual?.setsVencidosA;
  const setsB_UI = isInvertido && jogoAtual ? jogoAtual.setsVencidosA : jogoAtual?.setsVencidosB;
  
  const logicalLeftTeam = isInvertido ? 'B' : 'A';
  const logicalRightTeam = isInvertido ? 'A' : 'B';

  const handleCliquePonto = (partidaId: string, time: 'A' | 'B', valor: number) => {
    if (cooldownBotao) return;
    setCooldownBotao(true);
    props.atualizarPlacar(partidaId, time, valor);
    setTimeout(() => {
      setCooldownBotao(false);
    }, 400);
  };

  if (nivelAcesso === 'visitante') {
    return (
      <div className={styles.container}>
        <form onSubmit={props.handleLogin} className={styles.adminList} style={{maxWidth: '400px', borderColor: '#334155'}}>
          <h2 style={{color: '#f8fafc', textAlign: 'center', marginBottom: '1.5rem'}}>🔒 Acesso Restrito</h2>
          <input type="password" placeholder="Senha da Mesa ou Mestre" style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', marginBottom: '1rem', outline: 'none'}} value={props.senha} onChange={(e) => props.setSenha(e.target.value)} />
          <button type="submit" className={styles.btnEncerrar} style={{backgroundColor: '#3b82f6'}}>Acessar</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: '0', fontSize: '22px', color: nivelAcesso === 'mestre' ? '#ef4444' : '#38bdf8' }}>Painel da Mesa {nivelAcesso === 'mestre' ? '👑 (Modo Mestre)' : '📋 (Modo Mesário)'}</h2>
        <button onClick={props.fazerLogout} style={{ padding: '6px 16px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Sair</button>
      </div>

      {nivelAcesso === 'mestre' && statusTorneio !== 'aguardando_sorteio' && (
        <div className={styles.adminList} style={{ marginBottom: '20px', borderColor: '#3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => props.setMostrarEditorEquipes(!props.mostrarEditorEquipes)} style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
              {props.mostrarEditorEquipes ? '❌ Fechar Editor Global' : '🛠️ Abrir Editor Global (Nomes, Logos e Chaves)'}
            </button>
          </div>
          {props.mostrarEditorEquipes && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>Altere aqui para atualizar automaticamente em toda a tabela.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                {Object.values(timesMap).map(t => (
                  <div key={t.id} style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {regras?.mostrarLogos && <Image src={t.escudoUrl} alt="Logo" width={40} height={40} style={{ objectFit: 'contain', backgroundColor: 'white', borderRadius: '50%' }} />}
                      <input type="text" defaultValue={t.nome} onBlur={(e) => props.atualizarNomeEquipe(t.id, e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '8px', outline: 'none' }} />
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

      {jogoAtual && tA_UI && tB_UI ? (
        <div className={styles.placarBase}>
          <div className={styles.infoJogo}>
            <h2 className={styles.titulo}>Jogo em Andamento - {jogoAtual.horario}</h2>
            {isInvertido && <span style={{display: 'inline-block', backgroundColor: '#f59e0b', color: 'black', fontWeight: 'bold', padding: '4px 12px', borderRadius: '9999px', margin: '10px 0', fontSize: '12px', letterSpacing: '0.05em'}}>LADOS INVERTIDOS (FIVB)</span>}
            <div className={styles.sets}>Sets: {setsA_UI || 0} x {setsB_UI || 0}</div>
          </div>
          
          <div className={styles.timesContainer}>
            <div className={styles.timeBox}>
              <div className={styles.nomeTime}>{tA_UI.nome}</div>
              <div className={styles.pontos}>{ptsA_UI}</div>
              <div className={styles.controles}>
                <button
                  className={styles.btnMenos}
                  disabled={cooldownBotao}
                  style={{ opacity: cooldownBotao ? 0.5 : 1, cursor: cooldownBotao ? 'not-allowed' : 'pointer' }}
                  onClick={() => handleCliquePonto(jogoAtual.id, logicalLeftTeam, -1)}
                >
                  -
                </button>
                <button
                  className={styles.btnMais}
                  disabled={cooldownBotao}
                  style={{ opacity: cooldownBotao ? 0.5 : 1, cursor: cooldownBotao ? 'not-allowed' : 'pointer' }}
                  onClick={() => handleCliquePonto(jogoAtual.id, logicalLeftTeam, 1)}
                >
                  +
                </button>
              </div>
            </div>
            
            <div className={styles.versus}>X</div>
            
            <div className={styles.timeBox}>
              <div className={styles.nomeTime}>{tB_UI.nome}</div>
              <div className={styles.pontos}>{ptsB_UI}</div>
              <div className={styles.controles}>
                <button
                  className={styles.btnMenos}
                  disabled={cooldownBotao}
                  style={{ opacity: cooldownBotao ? 0.5 : 1, cursor: cooldownBotao ? 'not-allowed' : 'pointer' }}
                  onClick={() => handleCliquePonto(jogoAtual.id, logicalRightTeam, -1)}
                >
                  -
                </button>
                <button
                  className={styles.btnMais}
                  disabled={cooldownBotao}
                  style={{ opacity: cooldownBotao ? 0.5 : 1, cursor: cooldownBotao ? 'not-allowed' : 'pointer' }}
                  onClick={() => handleCliquePonto(jogoAtual.id, logicalRightTeam, 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          
          <button className={styles.btnEncerrar} onClick={() => props.encerrarAcao(jogoAtual)}>Encerrar Set / Partida</button>
        </div>
      ) : proximoJogo ? (
        <div className={styles.placarBase} style={{textAlign: 'center', padding: '3rem 2rem'}}>
          <h2 className={styles.titulo}>Próxima Partida: {proximoJogo.horario}</h2>
          <div style={{fontSize: '2rem', fontWeight: '800', color: '#f8fafc', margin: '2rem 0'}}>
            {proximoJogo.timeA.nome} <span style={{color: '#475569', margin: '0 1rem'}}>X</span> {proximoJogo.timeB.nome}
          </div>
          <button className={styles.btnEncerrar} style={{backgroundColor: '#3b82f6'}} onClick={() => props.iniciarPartida(proximoJogo.id)}>Iniciar Jogo</button>
        </div>
      ) : statusTorneio === 'fase_grupos' ? (
        <div className={styles.placarBase} style={{textAlign: 'center'}}>
          <h2 className={styles.titulo} style={{ marginBottom: '1.5rem' }}>Fase de Grupos Encerrada!</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {props.timesBase.length >= 4 && ( <button className={styles.btnEncerrar} style={{backgroundColor: '#3b82f6'}} onClick={props.gerarSemifinais}>🏆 Avançar para Semifinais</button> )}
            {props.timesBase.length >= 3 && ( <button className={styles.btnEncerrar} style={{ backgroundColor: '#10b981' }} onClick={props.gerarFinalDireta}>🥇 Gerar Grande Final Direta (1º x 2º)</button> )}
            <button className={styles.btnEncerrar} style={{ backgroundColor: '#f59e0b' }} onClick={props.encerrarCampeonatoPontosCorridos}>🛑 Encerrar e Coroar Campeão</button>
          </div>
        </div>
      ) : statusTorneio === 'semifinais' ? (
        <div className={styles.placarBase} style={{textAlign: 'center'}}>
          <h2 className={styles.titulo}>Semifinais Encerradas!</h2>
          <button className={styles.btnEncerrar} style={{marginTop: '2rem'}} onClick={props.gerarFinais}>Gerar Final</button>
        </div>
      ) : null}

      <div className={styles.adminList} style={{ borderColor: nivelAcesso === 'mestre' ? '#ef4444' : '#334155' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '15px', color: nivelAcesso === 'mestre' ? '#ef4444' : '#94a3b8' }}>{nivelAcesso === 'mestre' ? '👑 MODO MESTRE: Editar Qualquer Partida' : '✏️ Editar Partidas Finalizadas'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {partidas.filter(p => nivelAcesso === 'mestre' ? true : p.status === 'finalizado').map((p, idx) => (
            <div key={p.id} style={{ border: `1px solid ${nivelAcesso === 'mestre' ? '#ef4444' : '#334155'}`, padding: '15px', borderRadius: '12px', background: '#0f172a' }}>
              {props.partidaEditando === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {nivelAcesso === 'mestre' && (
                      <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'}}>
                          <input type="time" value={props.editHorario} onChange={e => props.setEditHorario(e.target.value)} style={{padding: '8px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', outline: 'none', fontWeight: 'bold'}} />
                          <select value={props.editMestreStatus} onChange={e => props.setEditMestreStatus(e.target.value)} style={{padding: '8px', borderRadius: '8px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', outline: 'none'}}>
                              <option value="pendente">Pendente</option><option value="em_andamento">Em Andamento</option><option value="finalizado">Finalizado</option>
                          </select>
                      </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      {nivelAcesso === 'mestre' ? (
                          <select value={props.editMestreTimeA} onChange={e => props.setEditMestreTimeA(e.target.value)} style={{width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155'}}>
                              {Object.values(timesMap).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                      ) : ( <div style={{fontWeight: '700', color: '#f8fafc', marginBottom: '10px'}}>{p.timeA.nome}</div> )}
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Pontos</label>
                      <input type="number" value={props.editPontosA} onChange={e => props.setEditPontosA(Number(e.target.value))} style={{ width: '100%', maxWidth: '80px', textAlign: 'center', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '1.25rem', fontWeight: 'bold' }} />
                      {isMd3Geral && <><label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '10px', marginBottom: '4px' }}>Sets</label><input type="number" value={props.editSetsA} onChange={e => props.setEditSetsA(Number(e.target.value))} style={{ width: '100%', maxWidth: '80px', textAlign: 'center', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} /></>}
                    </div>
                    <span style={{ fontWeight: '900', color: '#475569', margin: '0 15px' }}>X</span>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      {nivelAcesso === 'mestre' ? (
                          <select value={props.editMestreTimeB} onChange={e => props.setEditMestreTimeB(e.target.value)} style={{width: '100%', padding: '8px', marginBottom: '10px', borderRadius: '8px', background: '#1e293b', color: 'white', border: '1px solid #334155'}}>
                              {Object.values(timesMap).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                      ) : ( <div style={{fontWeight: '700', color: '#f8fafc', marginBottom: '10px'}}>{p.timeB.nome}</div> )}
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Pontos</label>
                      <input type="number" value={props.editPontosB} onChange={e => props.setEditPontosB(Number(e.target.value))} style={{ width: '100%', maxWidth: '80px', textAlign: 'center', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '1.25rem', fontWeight: 'bold' }} />
                      {isMd3Geral && <><label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '10px', marginBottom: '4px' }}>Sets</label><input type="number" value={props.editSetsB} onChange={e => props.setEditSetsB(Number(e.target.value))} style={{ width: '100%', maxWidth: '80px', textAlign: 'center', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} /></>}
                    </div>
                  </div>
                  {nivelAcesso === 'mestre' && (
                    <div style={{ marginTop: '10px', width: '100%' }}>
                      <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px', textAlign: 'center' }}>Histórico de Parciais (ex: 25-22,18-25)</label>
                      <input type="text" value={props.editParciais} onChange={e => props.setEditParciais(e.target.value)} placeholder="Vazio" style={{ width: '100%', textAlign: 'center', padding: '8px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                    <button onClick={() => props.setPartidaEditando(null)} style={{ padding: '10px 16px', background: '#475569', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}>Cancelar</button>
                    <button onClick={() => props.salvarEdicao(p.id)} style={{ padding: '10px 16px', background: nivelAcesso === 'mestre' ? '#ef4444' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 2 }}>Salvar {nivelAcesso === 'mestre' ? 'Mestre' : 'Correção'}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Jogo {idx + 1} {p.status !== 'finalizado' && `(${p.status})`}</span>
                    <span style={{fontWeight: '700', color: '#f8fafc', fontSize: '0.9rem'}}>{p.timeA.nome} {p.pontosA} x {p.pontosB} {p.timeB.nome}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => window.open(`/torneio/${window.location.pathname.split('/')[2]}/sumula/${p.id}`, '_blank')} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                      📄 Súmula
                    </button>
                    <button onClick={() => props.abrirEdicao(p)} style={{ padding: '6px 12px', background: nivelAcesso === 'mestre' ? '#ef4444' : '#334155', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{display: 'flex', gap: '20px', width: '100%', maxWidth: '600px', flexWrap: 'wrap', marginTop: '2rem'}}>
        <div className={styles.adminList} style={{ flex: 1, minWidth: '250px', textAlign: 'center', margin: 0 }}>
          <h3 style={{ marginBottom: '15px', color: '#f8fafc', fontSize: '1rem' }}>📲 Compartilhar Torneio</h3>
          <div style={{ background: 'white', padding: '10px', borderRadius: '12px', display: 'inline-block', marginBottom: '15px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(props.urlAtual)}`} alt="QR Code" width={150} height={150} style={{ display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            <button onClick={props.baixarQRCode} className={styles.btnEncerrar} style={{ backgroundColor: '#475569', padding: '0.75rem', fontSize: '0.875rem' }}>📥 Baixar QR Code</button>
            <button onClick={props.compartilharLink} className={styles.btnEncerrar} style={{ backgroundColor: '#3b82f6', padding: '0.75rem', fontSize: '0.875rem' }}>🔗 Copiar Link</button>
          </div>
        </div>
        
        <div className={styles.adminList} style={{ flex: 1, minWidth: '250px', textAlign: 'center', margin: 0, borderColor: '#ef4444' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '10px', fontSize: '1rem' }}>Gerar Relatório e Encerrar</h3>
          <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '20px' }}>Salve o PDF deste campeonato e limpe o banco de dados.</p>
          <button className={styles.btnEncerrar} style={{backgroundColor: '#ef4444', padding: '0.75rem', fontSize: '0.875rem'}} onClick={props.gerarRelatorioELimpar}>🖨️ Salvar PDF e Excluir Torneio</button>
        </div>
      </div>
    </div>
  );
}