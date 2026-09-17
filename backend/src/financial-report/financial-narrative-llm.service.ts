import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { formatCurrencyCompact, formatIndicatorValue } from './financial-report-formatting.util';

const MODEL = 'gemini-3.6-flash';
const TIMEOUT_MS = 45_000;

/**
 * Síntese executiva gerada por LLM (Gemini, camada gratuita — ver decisão do
 * usuário) como alternativa à montagem determinística em
 * renderExecutiveSummary() (financial-report-html.service.ts). Puramente
 * aditivo: sem GEMINI_API_KEY configurada, ou se a chamada falhar/expirar,
 * generate() devolve null e o chamador cai de volta no texto determinístico
 * — a versão determinística nunca deixa de existir, só é substituída quando
 * a geração por LLM tem sucesso.
 *
 * Grounding: o prompt carrega SOMENTE valores já calculados no payload do
 * relatório (nunca deixa o modelo inferir/estimar número novo) — mitiga
 * alucinação numérica num documento financeiro que vai para o cliente.
 */
@Injectable()
export class FinancialNarrativeLlmService {
  private readonly logger = new Logger(FinancialNarrativeLlmService.name);
  private readonly client: GoogleGenAI | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('GEMINI_API_KEY não configurada — síntese executiva por LLM desativada, usando texto determinístico.');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Gera a síntese executiva em português a partir dos dados já calculados
   * do payload do relatório. Retorna null (nunca lança) em qualquer falha —
   * chave ausente, timeout, erro de rede/API — pra nunca quebrar a geração
   * do relatório por causa de uma dependência externa.
   */
  async generateExecutiveSummary(payload: {
    cover: { companyName: string; baseDateLabel: string; comparativePeriodLabels: string[] };
    kanitz?: { current?: { fi: number | null; zoneLabel: string | null } } | null;
    statements: {
      bp?: { totalAtivo?: number | null };
      dre?: { resultadoLiquido?: number | null };
      dfc?: { caixaOperacional?: number | null };
    };
    findings: Array<{ title: string; description: string | null; classification: string | null }>;
  }): Promise<string | null> {
    const prompt = this.buildExecutiveSummaryPrompt(payload);
    return this.call(prompt, 'síntese executiva');
  }

  // generateIndicatorsCommentary foi removido — cada grupo de indicadores
  // (liquidez/endividamento/rentabilidade/eficiência) agora chama
  // generateStatementCommentary() diretamente, uma vez por grupo, pra ter
  // comentário próprio logo abaixo de CADA quadro (ver
  // financial-report-data.service.ts) em vez de um bloco único cobrindo
  // todos os grupos ao final da seção 2.

  /**
   * Comentário técnico de uma demonstração (BP, DRE ou DFC) — mesma
   * estrutura posição-atual/evolução-histórica dos indicadores, reutilizável
   * pelas três porque a forma dos dados (rótulo + valores por período) já é
   * a mesma independente da demonstração. Substitui buildCurrentStatementComment/
   * buildHistoricalStatementComment (financial-report-data.service.ts)
   * quando disponível — o chamador SEMPRE tem essas duas versões
   * determinísticas já calculadas como fallback, então null aqui nunca deixa
   * a seção sem comentário nenhum (diferente dos indicadores, que não
   * tinham versão determinística prévia).
   */
  async generateStatementCommentary(payload: {
    statementLabel: string;
    cover: { baseDateLabel: string; comparativePeriodLabels: string[] };
    rows: Array<{ label: string; values: Array<{ period: string; formatted: string | null }> }>;
  }): Promise<{ current: string | null; historical: string | null }> {
    const prompt = this.buildStatementPrompt(payload);
    const text = await this.call(prompt, `comentário de ${payload.statementLabel}`);
    if (!text) return { current: null, historical: null };

    const currentMatch = text.split('===POSICAO_ATUAL===')[1]?.split('===EVOLUCAO_HISTORICA===')[0]?.trim() ?? null;
    const historicalMatch = text.split('===EVOLUCAO_HISTORICA===')[1]?.trim() ?? null;
    return {
      current: currentMatch && currentMatch.length > 0 ? currentMatch : null,
      historical: historicalMatch && historicalMatch.length > 0 ? historicalMatch : null,
    };
  }

  /** Chamada crua ao Gemini com timeout — retorna null (nunca lança) em qualquer falha: chave ausente, timeout, erro de rede/API. */
  private async call(prompt: string, label: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const result = await Promise.race([
        this.client.models.generateContent({ model: MODEL, contents: prompt }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
      ]);
      const text = result?.text?.trim();
      return text && text.length > 0 ? text : null;
    } catch (err) {
      this.logger.warn(`Falha ao gerar ${label} via LLM, usando fallback determinístico: ${(err as Error).message}`);
      return null;
    }
  }

  private buildExecutiveSummaryPrompt(payload: Parameters<FinancialNarrativeLlmService['generateExecutiveSummary']>[0]): string {
    const lines: string[] = [];
    lines.push(`Empresa: ${payload.cover.companyName}`);
    lines.push(`Data-base: ${payload.cover.baseDateLabel}`);
    if (payload.cover.comparativePeriodLabels.length > 0) {
      lines.push(`Períodos comparativos: ${payload.cover.comparativePeriodLabels.join(', ')}`);
    }
    if (payload.statements.bp?.totalAtivo != null) {
      lines.push(`Total do ativo: ${formatCurrencyCompact(payload.statements.bp.totalAtivo)}`);
    }
    if (payload.statements.dre?.resultadoLiquido != null) {
      lines.push(`Resultado líquido do período: ${formatCurrencyCompact(payload.statements.dre.resultadoLiquido)}`);
    }
    if (payload.statements.dfc?.caixaOperacional != null) {
      lines.push(`Caixa líquido das atividades operacionais: ${formatCurrencyCompact(payload.statements.dfc.caixaOperacional)}`);
    }
    const kanitzFi = payload.kanitz?.current?.fi;
    if (kanitzFi != null) {
      lines.push(`Fator de Insolvência de Kanitz: ${formatIndicatorValue('kanitz_fator_insolvencia', kanitzFi)} (${payload.kanitz?.current?.zoneLabel ?? ''})`);
    }
    if (payload.findings.length > 0) {
      lines.push('Achados aprovados para o relatório:');
      for (const f of payload.findings.slice(0, 8)) {
        lines.push(`- [${f.classification ?? 'sem classificação'}] ${f.title}${f.description ? ` — ${f.description}` : ''}`);
      }
    }

    return [
      'Você é um consultor financeiro sênior escrevendo a síntese executiva de um relatório de análise econômico-financeira, dirigida à diretoria/CFO de uma empresa.',
      '',
      'Regras obrigatórias:',
      '- Use SOMENTE os números e fatos listados abaixo em "DADOS". Nunca invente, estime, arredonde de forma diferente ou complete valores que não foram fornecidos.',
      '- Escreva em português do Brasil, regra normal de maiúsculas (só a primeira letra de frase, nomes próprios e siglas), sem títulos, sem listas com marcadores, sem emojis.',
      '- Registro formal e técnico de parecer de consultoria financeira: terminologia precisa da área (liquidez, alavancagem, capital de giro, conversão de caixa, margem, rentabilidade, ciclo operacional/financeiro etc.), nunca linguagem coloquial ou aproximada.',
      '- Tom de analista sênior experiente, direto e objetivo — não use linguagem genérica de IA ("é importante notar que", "em suma", etc.) nem floreios.',
      '- Objetividade: frases diretas, sem adjetivos supérfluos, sem dramatização e sem hedging desnecessário ("pode ser que", "talvez", "aparentemente") — afirme o que os números mostram com a precisão que os dados permitem.',
      '- Nunca use a expressão "pontos percentuais" (nem a abreviação "p.p."). Toda diferença ou proporção em percentual, incluindo diferença entre duas margens/taxas, deve ser escrita apenas com "%".',
      '- 2 a 4 parágrafos corridos, conectando os números numa leitura coerente (ex.: como o resultado e o caixa operacional se relacionam no período), não apenas repetindo cada dado isoladamente.',
      '- Nunca afirme relação de causa e efeito entre dois fatos apenas porque ocorreram no mesmo período (correlação não é causalidade). Descreva o que os dados mostram lado a lado; se uma causa for sugerida pelos achados fornecidos, atribua-a a eles ("os achados indicam que..."), nunca a uma inferência sua sobre dados que não a sustentam.',
      '- Se os dados não permitirem uma leitura clara, seja direto sobre isso em vez de forçar uma conclusão.',
      '',
      'DADOS:',
      ...lines,
      '',
      'Escreva a síntese executiva agora.',
    ].join('\n');
  }

  private buildStatementPrompt(payload: Parameters<FinancialNarrativeLlmService['generateStatementCommentary']>[0]): string {
    const lines: string[] = [];
    lines.push(`Demonstração: ${payload.statementLabel}`);
    lines.push(`Data-base: ${payload.cover.baseDateLabel}`);
    if (payload.cover.comparativePeriodLabels.length > 0) {
      lines.push(`Períodos comparativos: ${payload.cover.comparativePeriodLabels.join(', ')}`);
    }
    for (const row of payload.rows) {
      const valuesStr = row.values.filter((v) => v.formatted !== null).map((v) => `${v.period}=${v.formatted}`).join(', ');
      if (valuesStr) lines.push(`- ${row.label}: ${valuesStr}`);
    }

    return [
      `Você é um consultor financeiro sênior escrevendo o comentário técnico da seção "${payload.statementLabel}" de um relatório de análise econômico-financeira, dirigido à diretoria/CFO de uma empresa.`,
      '',
      'Regras obrigatórias:',
      '- Use SOMENTE os números listados abaixo em "DADOS". Nunca invente, estime ou complete rubricas/valores que não foram fornecidos.',
      '- Escreva em português do Brasil, regra normal de maiúsculas, sem títulos, sem listas com marcadores, sem emojis.',
      '- Registro formal e técnico de parecer de consultoria financeira: terminologia contábil precisa, nunca linguagem coloquial ou aproximada.',
      '- Tom de analista sênior experiente, direto e objetivo — não use linguagem genérica de IA ("é importante notar que", "em suma", etc.) nem floreios.',
      '- Objetividade: frases diretas, sem adjetivos supérfluos, sem dramatização e sem hedging desnecessário ("pode ser que", "talvez", "aparentemente") — afirme o que os números mostram com a precisão que os dados permitem.',
      '- Nunca use a expressão "pontos percentuais" (nem a abreviação "p.p."). Toda diferença ou proporção em percentual, incluindo diferença entre duas margens/taxas, deve ser escrita apenas com "%".',
      '- Priorize as rubricas de maior participação/variação — não liste cada linha da demonstração isoladamente como um dicionário, conecte-as numa leitura coerente.',
      '- Nunca afirme relação de causa e efeito entre dois fatos apenas porque ocorreram no mesmo período (correlação não é causalidade) — descreva o que os dados mostram lado a lado, sem atribuir origem/motivo que os dados fornecidos não sustentam.',
      '- Se uma razão/percentual tiver denominador muito pequeno perto de zero, não a apresente como um indicador normal — descreva os dois valores em separado e explique que a relação perde representatividade nesse caso.',
      '- Se os dados não permitirem uma leitura clara, seja direto sobre isso em vez de forçar uma conclusão.',
      '',
      'Estruture sua resposta em EXATAMENTE duas partes, cada uma começando sozinha numa linha com o marcador exato abaixo (sem markdown, sem aspas, sem nada além do marcador nessa linha):',
      '',
      '===POSICAO_ATUAL===',
      '(1 a 2 parágrafos comentando tecnicamente a posição/composição na data-base atual)',
      '',
      '===EVOLUCAO_HISTORICA===',
      '(1 a 2 parágrafos comentando a evolução entre os períodos comparativos e a data-base atual, destacando as variações mais relevantes e prováveis causas — omita esta parte apenas se houver um único período nos dados)',
      '',
      'DADOS:',
      ...lines,
      '',
      'Escreva o comentário técnico agora, seguindo exatamente a estrutura de marcadores pedida.',
    ].join('\n');
  }
}
