"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../firebase';
import { ref, set } from 'firebase/database';
import styles from './setup.module.css';

interface TimeConfig {
  id: string;
  nome: string;
  escudoUrl: string;
}

export default function Setup() {
  const router = useRouter();
  
  const [regras, setRegras] = useState({
    horarioInicio: '08:00',
    intervaloMinutos: 45,
    formatoGrupos: 'set_unico',
    formatoFinais: 'melhor_de_3',
    sistemaClassificacao: 'vitorias_simples',
    ptsVitoriaPerfeita: 3,
    ptsVitoriaTiebreak: 2,
    ptsDerrotaTiebreak: 1
  });

  const [times, setTimes] = useState<TimeConfig[]>([
    { id: 'time_1', nome: '', escudoUrl: '' },
    { id: 'time_2', nome: '', escudoUrl: '' },
    { id: 'time_3', nome: '', escudoUrl: '' },
    { id: 'time_4', nome: '', escudoUrl: '' },
  ]);

  const handleRegraChange = (campo: string, valor: string | number) => {
    setRegras(prev => ({ ...prev, [campo]: valor }));
  };

  const handleTimeChange = (index: number, campo: keyof TimeConfig, valor: string) => {
    const novosTimes = [...times];
    novosTimes[index][campo] = valor;
    setTimes(novosTimes);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleTimeChange(index, 'escudoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const adicionarTime = () => {
    if (times.length >= 12) {
      alert("O limite máximo recomendado é de 12 equipes.");
      return;
    }
    const novoId = `time_${times.length + 1}`;
    setTimes([...times, { id: novoId, nome: '', escudoUrl: '' }]);
  };

  const removerTime = (index: number) => {
    if (times.length <= 3) {
      alert("O torneio precisa de pelo menos 3 equipes.");
      return;
    }
    const novosTimes = times.filter((_, i) => i !== index);
    setTimes(novosTimes);
  };

  const salvarSetup = async () => {
    if (times.length < 3) {
      alert('Cadastre pelo menos 3 equipes para iniciar o torneio.');
      return;
    }

    if (times.some(t => !t.nome || !t.escudoUrl)) {
      alert('Preencha o nome e o brasão de todas as equipes cadastradas!');
      return;
    }

    const timesObj: Record<string, TimeConfig & { sets_vencidos: number; total_pontos: number; pontos_classificacao: number }> = {};
    
    times.forEach((t, i) => {
      const idFormatado = `time_${i + 1}`;
      timesObj[idFormatado] = {
        ...t,
        id: idFormatado,
        sets_vencidos: 0,
        total_pontos: 0,
        pontos_classificacao: 0
      };
    });

    try {
      await set(ref(db, 'torneio'), {
        config: {
          status: 'aguardando_sorteio',
          regras: regras
        },
        times: timesObj
      });

      router.push('/tabela');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar os dados.');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Configuração do Campeonato</h1>

      <div className={styles.configPanel}>
        <h2 className={styles.configTitle}>Regras e Formato</h2>
        
        <div className={styles.configGrid}>
          <div className={styles.configItem}>
            <label>Horário de Início (1º Jogo)</label>
            <input 
              type="time" 
              className={styles.input} 
              value={regras.horarioInicio}
              onChange={(e) => handleRegraChange('horarioInicio', e.target.value)}
            />
          </div>

          <div className={styles.configItem}>
            <label>Intervalo entre jogos (Minutos)</label>
            <input 
              type="number" 
              className={styles.input} 
              value={regras.intervaloMinutos}
              onChange={(e) => handleRegraChange('intervaloMinutos', Number(e.target.value))}
            />
          </div>

          <div className={styles.configItem}>
            <label>Fase de Grupos</label>
            <select 
              className={styles.select}
              value={regras.formatoGrupos}
              onChange={(e) => handleRegraChange('formatoGrupos', e.target.value)}
            >
              <option value="set_unico">Set Único (até 25)</option>
              <option value="melhor_de_3">Melhor de 3 (com Tie-Break)</option>
            </select>
          </div>

          <div className={styles.configItem}>
            <label>Finais e Semifinais</label>
            <select 
              className={styles.select}
              value={regras.formatoFinais}
              onChange={(e) => handleRegraChange('formatoFinais', e.target.value)}
            >
              <option value="melhor_de_3">Melhor de 3 (com Tie-Break)</option>
              <option value="set_unico">Set Único (até 25)</option>
            </select>
          </div>

          <div className={styles.configItem}>
            <label>Sistema de Classificação</label>
            <select 
              className={styles.select}
              value={regras.sistemaClassificacao}
              onChange={(e) => handleRegraChange('sistemaClassificacao', e.target.value)}
            >
              <option value="vitorias_simples">Vitórias Simples (Quem ganha mais passa)</option>
              <option value="sistema_pontos">Sistema de Pontos (3 pts p/ 2x0, 2 pts p/ 2x1)</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className={styles.title} style={{ margin: 0 }}>Cadastro de Equipes ({times.length})</h2>
        <button 
          onClick={adicionarTime} 
          style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          + Adicionar Equipe
        </button>
      </div>

      <div className={styles.grid}>
        {times.map((time, index) => (
          <div key={index} className={styles.card} style={{ position: 'relative' }}>
            {times.length > 3 && (
              <button 
                onClick={() => removerTime(index)}
                style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer', fontWeight: 'bold' }}
                title="Remover time"
              >
                ✕
              </button>
            )}
            <h3>Time {index + 1}</h3>
            <div className={styles.configItem}>
              <label>Nome:</label>
              <input
                type="text"
                className={styles.input}
                value={time.nome}
                onChange={(e) => handleTimeChange(index, 'nome', e.target.value)}
              />
            </div>
            <div className={styles.configItem}>
              <label>Brasão/Logo:</label>
              <input
                type="file"
                accept="image/*"
                className={styles.input}
                onChange={(e) => handleImageUpload(index, e)}
              />
            </div>
          </div>
        ))}
      </div>

      <button onClick={salvarSetup} className={styles.btnPrimary} style={{ marginTop: '20px' }}>
        Salvar Configurações e Avançar
      </button>
    </div>
  );
}