'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../../supabase';
import { Patota, PatotaInscricao } from '../../../types/patota';

export default function PaginaPatotaSlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const [user, setUser] = useState<User | null>(null);
  const [patota, setPatota] = useState<Patota | null>(null);
  const [inscricoes, setInscricoes] = useState<PatotaInscricao[]>([]);
  const [isOrganizador, setIsOrganizador] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const [nomeJogador, setNomeJogador] = useState('');
  const [whatsappJogador, setWhatsappJogador] = useState('');

  const carregarPatota = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const usuarioAtual = authData.user ?? null;
    setUser(usuarioAtual);

    if (usuarioAtual) {
      setNomeJogador((prev) => prev || usuarioAtual.user_metadata?.full_name || '');
    }

    const { data: patotaData } = await supabase
      .from('patotas')
      .select('*')
      .eq('slug', slug)
      .single();

    if (!patotaData) {
      setCarregando(false);
      return;
    }

    const patotaTipada = patotaData as Patota;
    setPatota(patotaTipada);

    const { data: inscData } = await supabase
      .from('patota_inscricoes')
      .select('*')
      .eq('patota_id', patotaTipada.id)
      .in('status_vaga', ['confirmado', 'espera'])
      .order('created_at', { ascending: true });

    if (inscData) setInscricoes(inscData as PatotaInscricao[]);

    if (usuarioAtual) {
      if (patotaTipada.criador_id === usuarioAtual.id) {
        setIsOrganizador(true);
      } else {
        const { data: orgData } = await supabase
          .from('patota_organizadores')
          .select('user_id')
          .eq('patota_id', patotaTipada.id)
          .eq('user_id', usuarioAtual.id)
          .maybeSingle();
        setIsOrganizador(Boolean(orgData));
      }
    }

    setCarregando(false);
  }, [slug]);

  useEffect(() => {
    const inicializar = async () => {
      await carregarPatota();
    };
    inicializar();
  }, [carregarPatota]);

  // Realtime na lista de inscrições
  useEffect(() => {
    if (!patota?.id) return;
    const channel = supabase
      .channel(`patota-${patota.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patota_inscricoes', filter: `patota_id=eq.${patota.id}` },
        () => carregarPatota()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patota?.id, carregarPatota]);

  const entrarComGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const handleInscrever = async () => {
    if (!patota || !user) return;
    if (!nomeJogador.trim()) return alert('Informe seu nome para entrar na lista.');

    setProcessando(true);
    const { data, error } = await supabase.rpc('inscrever_patota', {
      p_patota_id: patota.id,
      p_nome_jogador: nomeJogador.trim(),
      p_whatsapp_jogador: whatsappJogador.trim() || null,
    });
    setProcessando(false);

    if (error) {
      alert(error.message);
    } else {
      alert(data === 'confirmado' ? 'Vaga confirmada na lista!' : 'Lista cheia! Você entrou na fila de espera.');
      await carregarPatota();
    }
  };

  const handleSair = async () => {
    if (!patota || !user) return;
    if (!confirm('Tem certeza que deseja sair da lista?')) return;

    setProcessando(true);
    const { error } = await supabase.rpc('sair_patota', {
      p_patota_id: patota.id,
    });
    setProcessando(false);

    if (error) {
      alert(error.message);
    } else {
      await carregarPatota();
    }
  };

  const atualizarPagamento = async (inscricaoId: string, novoStatus: string) => {
    const { error } = await supabase
      .from('patota_inscricoes')
      .update({ status_pagamento: novoStatus })
      .eq('id', inscricaoId);

    if (error) alert('Erro ao atualizar pagamento.');
    else await carregarPatota();
  };

  const copiarPix = () => {
    if (!patota?.pix_chave) return;
    navigator.clipboard.writeText(patota.pix_chave);
    alert('Chave Pix copiada!');
  };

  const copiarListaWhatsApp = () => {
    if (!patota) return;
    const confirmados = inscricoes.filter((i) => i.status_vaga === 'confirmado');
    const espera = inscricoes.filter((i) => i.status_vaga === 'espera');

    const dataFmt = new Date(patota.data_hora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    let texto = `🏐 *${patota.titulo}*\n📍 ${patota.local_nome}\n📅 ${dataFmt}\n💰 R$ ${Number(patota.valor).toFixed(2).replace('.', ',')}\n\n`;
    texto += `*Confirmados (${confirmados.length}/${patota.vagas_total}):*\n`;
    confirmados.forEach((c, idx) => {
      const pago = c.status_pagamento === 'pago' ? ' ✅' : '';
      texto += `${idx + 1}. ${c.nome_jogador}${pago}\n`;
    });

    if (espera.length > 0) {
      texto += `\n*Fila de Espera:*\n`;
      espera.forEach((e, idx) => {
        texto += `${idx + 1}. ${e.nome_jogador}\n`;
      });
    }

    texto += `\n🔗 Lista online: ${window.location.href}`;
    navigator.clipboard.writeText(texto);
    alert('Lista copiada para colar no WhatsApp!');
  };

  if (carregando) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '40px', textAlign: 'center' }}>Carregando patota...</div>;
  }

  if (!patota) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '40px', textAlign: 'center' }}>
        <h2>Patota não encontrada</h2>
        <Link href="/patotas" style={{ color: '#60a5fa' }}>← Voltar para Patotas</Link>
      </div>
    );
  }

  const confirmados = inscricoes.filter((i) => i.status_vaga === 'confirmado');
  const espera = inscricoes.filter((i) => i.status_vaga === 'espera');
  const minhaInscricao = user ? inscricoes.find((i) => i.user_id === user.id) : undefined;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <Link href="/patotas" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px' }}>← Ver todas as patotas</Link>

        {/* Card Principal da Patota */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{patota.titulo}</h1>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold', backgroundColor: patota.status === 'aberta' ? '#065f46' : '#7f1d1d', color: '#fff' }}>
              {patota.status.toUpperCase()}
            </span>
          </div>

          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#cbd5e1' }}>
            <div>📍 <strong>Local:</strong> {patota.local_nome} {patota.local_maps_url && <a href={patota.local_maps_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', marginLeft: '6px' }}>(Abrir no Maps)</a>}</div>
            <div>📅 <strong>Data:</strong> {new Date(patota.data_hora).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}</div>
            <div>🏐 <strong>Formato / Nível:</strong> {patota.formato || '6x6'} • {patota.nivel || 'Livre'}</div>
            <div>💰 <strong>Valor:</strong> R$ {Number(patota.valor).toFixed(2).replace('.', ',')} • <strong>Vagas:</strong> {confirmados.length}/{patota.vagas_total}</div>
          </div>

          {patota.pix_chave && (
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px' }}>
                <div style={{ color: '#94a3b8' }}>Pix ({patota.pix_titular || 'Organizador'}):</div>
                <strong style={{ color: '#38bdf8' }}>{patota.pix_chave}</strong>
              </div>
              <button onClick={copiarPix} style={{ padding: '6px 12px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                📋 Copiar Pix
              </button>
            </div>
          )}

          <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={copiarListaWhatsApp} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              📲 Copiar Lista p/ WhatsApp
            </button>
          </div>
        </div>

        {/* Bloco de Inscrição do Usuário */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
          {!user ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: '14px' }}>Faça login para colocar seu nome na lista:</p>
              <button onClick={entrarComGoogle} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Entrar com Google
              </button>
            </div>
          ) : minhaInscricao ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '15px' }}>
                Você está na lista como <strong>{minhaInscricao.nome_jogador}</strong> — Status:{' '}
                <strong style={{ color: minhaInscricao.status_vaga === 'confirmado' ? '#34d399' : '#fbbf24' }}>
                  {minhaInscricao.status_vaga === 'confirmado' ? 'CONFIRMADO' : 'FILA DE ESPERA'}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {minhaInscricao.status_pagamento !== 'pago' && (
                  <button
                    onClick={() => atualizarPagamento(minhaInscricao.id, 'aguardando_confirmacao')}
                    disabled={minhaInscricao.status_pagamento === 'aguardando_confirmacao'}
                    style={{ padding: '10px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: minhaInscricao.status_pagamento === 'aguardando_confirmacao' ? 0.6 : 1 }}
                  >
                    {minhaInscricao.status_pagamento === 'aguardando_confirmacao' ? '⏳ Pagamento informado' : '💸 Já fiz o Pix'}
                  </button>
                )}
                <button
                  onClick={handleSair}
                  disabled={processando}
                  style={{ padding: '10px 16px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Sair da Lista
                </button>
              </div>
            </div>
          ) : patota.status === 'aberta' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <input
                  placeholder="Seu nome na lista *"
                  value={nomeJogador}
                  onChange={(e) => setNomeJogador(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                />
                <input
                  placeholder="WhatsApp (opcional)"
                  value={whatsappJogador}
                  onChange={(e) => setWhatsappJogador(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' }}
                />
              </div>
              <button
                onClick={handleInscrever}
                disabled={processando}
                style={{ padding: '12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
              >
                {processando ? 'Salvando...' : confirmados.length < patota.vagas_total ? '✅ Confirmar Minha Vaga' : '⏳ Entrar na Fila de Espera'}
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, textAlign: 'center', color: '#f87171' }}>Esta patota está encerrada.</p>
          )}
        </div>

        {/* Lista de Confirmados */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
          <h2 style={{ margin: '0 0 14px', fontSize: '17px' }}>✅ Confirmados ({confirmados.length}/{patota.vagas_total})</h2>
          {confirmados.length === 0 ? (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Ninguém confirmado ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {confirmados.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155', gap: '10px' }}>
                  <div>
                    <span style={{ color: '#64748b', marginRight: '8px', fontWeight: 'bold' }}>{idx + 1}.</span>
                    <strong>{item.nome_jogador}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: item.status_pagamento === 'pago' ? '#34d399' : item.status_pagamento === 'aguardando_confirmacao' ? '#fbbf24' : '#94a3b8' }}>
                      {item.status_pagamento === 'pago' ? 'Pago' : item.status_pagamento === 'aguardando_confirmacao' ? 'Aguardando' : 'Pendente'}
                    </span>
                    {isOrganizador && (
                      <button
                        onClick={() => atualizarPagamento(item.id, item.status_pagamento === 'pago' ? 'pendente' : 'pago')}
                        style={{ padding: '4px 10px', backgroundColor: item.status_pagamento === 'pago' ? '#334155' : '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        {item.status_pagamento === 'pago' ? 'Estornar' : 'Dar Baixa'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fila de Espera */}
        {espera.length > 0 && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '17px', color: '#fbbf24' }}>⏳ Fila de Espera ({espera.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {espera.map((item, idx) => (
                <div key={item.id} style={{ padding: '10px 12px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                  <span style={{ color: '#fbbf24', marginRight: '8px', fontWeight: 'bold' }}>{idx + 1}.</span>
                  <strong>{item.nome_jogador}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}