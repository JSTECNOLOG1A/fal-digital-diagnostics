import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download } from 'lucide-react';

export default function QuestionsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDimension, setFilterDimension] = useState('');

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['falQuestions'],
    queryFn: async () => {
      const qs = await base44.entities.FalQuestion.list();
      return qs.sort((a, b) => {
        if (a.dimension_key !== b.dimension_key) return a.dimension_key.localeCompare(b.dimension_key);
        if (a.subdimension_key !== b.subdimension_key) return a.subdimension_key.localeCompare(b.subdimension_key);
        return a.sequence_order - b.sequence_order;
      });
    }
  });

  const dimensions = [...new Set(questions.map(q => q.dimension_key))].sort();
  
  const filtered = questions.filter(q => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         q.question_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDimension = !filterDimension || q.dimension_key === filterDimension;
    return matchesSearch && matchesDimension;
  });

  const downloadCSV = async () => {
    const headers = ['question_id', 'dimension_key', 'subdimension_key', 'cluster_key', 'question_text', 'process_stage', 'sequence_order', 'question_weight'];
    const rows = filtered.map(q => [
      q.question_id,
      q.dimension_key,
      q.subdimension_key,
      q.cluster_key,
      `"${(q.question_text || '').replace(/"/g, '""')}"`,
      q.process_stage,
      q.sequence_order,
      q.question_weight || '1.0'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fal_questions.csv';
    a.click();
  };

  if (isLoading) return <div className="p-8 text-center">Carregando perguntas...</div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Perguntas FAL</h1>
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Buscar pergunta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
          </div>
          <select
            value={filterDimension}
            onChange={(e) => setFilterDimension(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">Todas as dimensões</option>
            {dimensions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <Button onClick={downloadCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        {filtered.length} perguntas ({questions.length} no total)
      </div>

      <div className="space-y-3">
        {filtered.map(q => (
          <Card key={q.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{q.dimension_key}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{q.subdimension_key}</span>
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{q.process_stage}</span>
                  </div>
                  <CardTitle className="text-base">{q.question_text}</CardTitle>
                  <div className="text-xs text-gray-500 mt-2">ID: {q.question_id}</div>
                </div>
                <div className="text-sm text-gray-600 text-right">
                  <div>Seq: {q.sequence_order}</div>
                  <div>Peso: {q.question_weight}</div>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}