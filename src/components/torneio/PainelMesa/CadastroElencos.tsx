'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../supabase';
import { Jogador, TimeDb } from '../../../types/torneio';

interface Props {
  torneioId: string;
}

export default function CadastroElencos({ torneioId }: Props) {
  const [times, setTimes] = useState<TimeDb[]>([]);
  const [timeSelecionadoId, setTimeSelecionadoId] = useState<string>('');
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    async function carregarTimes() {
      const { data } = await supabase
        .from('times')
        .select('*')
        .eq('torneio_id', torneioId)
        .order('nome');

      if (data && data.length > 0) {
        setTimes(data as TimeDb[]);
        setTimeSelecionadoId(data[0].id);
        setJogadores((data[0].jogadores as Jogador[]) || []);
      }
    }
    carregarTimes();
  }, [torneioId]);

  const selecionarTime = (id: string) => {
    setTimeSelecionadoId(id);
    const time = times.find((t) => t.id === id);
    setJogadores(time?.jogadores || []);
  };

  const adicionarJogador = () => {
    setJogadores([...jogadores, { numero: '', nome: '', isLibero: false }]);
  };

  const atualizarJogador = (index: number, campo: keyof Jogador, valor: string | boolean) => {
    const copia = [...jogadores];
    copia[index] = { ...copia[index], [campo]: valor };
    setJogadores(copia);
  };

  const removerJogador = (index: number) => {
    setJogadores(jogadores.filter((_, i) => i !== index));
  };

  const salvarElenco = async () => {
    if (!timeSelecionadoId) return;
    setSalvando(true);

    const listaLimpa = jogadores.filter((j) => j.nome.trim() !== '' || j.numero.trim() !== '');

    const { error } = await supabase
      .from('times')
      .update({ jogadores: listaLimpa })
      .eq('id', timeSelecionadoId);

    setSalvando(false);

    if (error) {
      alert('Erro ao salvar elenco.');
      console.error(error);
    } else {
      setTimes(times.map((t) => (t.id === timeSelecionadoId ? { ...t, jogadores: listaLimpa } : t)));
      setJogadores(listaLimpa);
      alert('Elenco salvo! Já vai aparecer preenchido nas súmulas.');
    }
  };

  return (
    <div style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      color: '#f8fafc'
    }}>
      {/* Cabeçalho com botão expandir/recolher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>📋 Elencos & Súmulas das Finais</h3>
        <button
          onClick={() => setAberto(!aberto)}
          style={{
            padding: '6px 14px',
            backgroundColor: '#334155',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          {aberto ? 'Ocultar Elencos' : 'Gerenciar Elencos'}
        </button>
      </div>

      {/* Botões rápidos de Súmulas em Branco para as Finais */}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
          🖨️ Súmulas em branco (Fase Final):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { slug: 'semifinal-1', label: 'Semifinal 1' },
            { slug: 'semifinal-2', label: 'Semifinal 2' },
            { slug: 'terceiro-lugar', label: 'Disputa 3º Lugar' },
            { slug: 'final', label: 'Grande Final' },
          ].map((item) => (
            <Link
              key={item.slug}
              href={`/torneio/${torneioId}/sumula/${item.slug}`}
              target="_blank"
              style={{
                padding: '6px 12px',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: 'bold',
                textDecoration: 'none'
              }}
            >
              📄 {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Editor de Elenco */}
      {aberto && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
              Selecione o Time
            </label>
            <select
              value={timeSelecionadoId}
              onChange={(e) => selecionarTime(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '320px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #475569'
              }}
            >
              {times.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.jogadores?.length || 0} atletas)
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {jogadores.map((j, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Nº"
                  value={j.numero}
                  onChange={(e) => atualizarJogador(index, 'numero', e.target.value)}
                  style={{
                    width: '60px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    border: '1px solid #475569',
                    textAlign: 'center'
                  }}
                />
                <input
                  type="text"
                  placeholder="Nome do atleta"
                  value={j.nome}
                  onChange={(e) => atualizarJogador(index, 'nome', e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    color: '#fff',
                    border: '1px solid #475569'
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!j.isLibero}
                    onChange={(e) => atualizarJogador(index, 'isLibero', e.target.checked)}
                  />
                  Líbero
                </label>
                <button
                  onClick={() => removerJogador(index)}
                  style={{
                    padding: '6px 10px',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={adicionarJogador}
              style={{
                padding: '8px 14px',
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              + Adicionar Atleta
            </button>

            <button
              onClick={salvarElenco}
              disabled={salvando}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--cor-destaque, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {salvando ? 'Salvando...' : 'Salvar Elenco'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
