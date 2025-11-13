"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  ShoppingBag, 
  Pill, 
  Coffee, 
  Store, 
  UtensilsCrossed,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from "lucide-react"

export interface QuizQuestion {
  id: number
  question: string
  options: {
    text: string
    value: string
    icon: any
  }[]
}

export interface QuizResult {
  type: string
  name: string
  description: string
  icon: any
  imageUrl?: string
}

const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "O que você está procurando?",
    options: [
      { text: "Alimentos e produtos do dia a dia", value: "food", icon: ShoppingBag },
      { text: "Medicamentos e produtos de saúde", value: "health", icon: Pill },
      { text: "Comida pronta ou lanches", value: "meal", icon: Coffee },
      { text: "Produtos variados", value: "general", icon: Store },
    ]
  },
  {
    id: 2,
    question: "Qual é a sua prioridade?",
    options: [
      { text: "Variedade de produtos", value: "variety", icon: ShoppingBag },
      { text: "Atendimento especializado", value: "specialized", icon: Pill },
      { text: "Rapidez e conveniência", value: "quick", icon: Coffee },
      { text: "Preço baixo", value: "price", icon: Store },
    ]
  },
  {
    id: 3,
    question: "Que tipo de ambiente você prefere?",
    options: [
      { text: "Grande e completo", value: "large", icon: ShoppingBag },
      { text: "Profissional e limpo", value: "professional", icon: Pill },
      { text: "Aconchegante e casual", value: "cozy", icon: Coffee },
      { text: "Simples e prático", value: "simple", icon: Store },
    ]
  }
]

const quizResults: Record<string, QuizResult> = {
  "Mercado": {
    type: "Mercado",
    name: "Mercado/Supermercado",
    description: "Estabelecimentos com grande variedade de produtos alimentícios, bebidas, produtos de limpeza e itens do dia a dia.",
    icon: ShoppingBag,
  },
  "Farmácia": {
    type: "Farmácia",
    name: "Farmácia/Drogaria",
    description: "Estabelecimentos especializados em medicamentos, produtos de saúde, higiene pessoal e bem-estar.",
    icon: Pill,
  },
  "Lanchonete": {
    type: "Lanchonete",
    name: "Lanchonete/Fast Food",
    description: "Estabelecimentos que servem refeições rápidas, lanches, salgados e bebidas para consumo imediato.",
    icon: Coffee,
  },
  "Cafeteria": {
    type: "Cafeteria",
    name: "Cafeteria/Café",
    description: "Estabelecimentos especializados em café, bebidas quentes, doces e ambiente aconchegante.",
    icon: Coffee,
  },
  "Padaria": {
    type: "Padaria",
    name: "Padaria/Confeitaria",
    description: "Estabelecimentos que produzem e vendem pães, bolos, doces e produtos de confeitaria.",
    icon: Store,
  },
  "Restaurante": {
    type: "Restaurante",
    name: "Restaurante",
    description: "Estabelecimentos que servem refeições completas em ambiente mais formal.",
    icon: UtensilsCrossed,
  },
}

interface EstablishmentQuizProps {
  onComplete: (result: QuizResult) => void
  onGenerateImage?: (type: string) => Promise<string | null>
}

export function EstablishmentQuiz({ onComplete, onGenerateImage }: EstablishmentQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100

  const handleAnswer = async (value: string) => {
    const newAnswers = [...answers, value]
    setAnswers(newAnswers)

    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // Quiz completo - determina resultado
      const determinedResult = determineResult(newAnswers)
      setResult(determinedResult)
      setIsComplete(true)

      // Gera imagem se função fornecida
      if (onGenerateImage && determinedResult) {
        setIsGeneratingImage(true)
        const imageUrl = await onGenerateImage(determinedResult.type)
        if (imageUrl) {
          determinedResult.imageUrl = imageUrl
          setResult({ ...determinedResult })
        }
        setIsGeneratingImage(false)
      }

      onComplete(determinedResult)
    }
  }

  const determineResult = (userAnswers: string[]): QuizResult => {
    // Lógica para determinar o tipo de estabelecimento baseado nas respostas
    const answerString = userAnswers.join("-")

    // Mercado: food + variety/price + large
    if (answerString.includes("food") && (answerString.includes("variety") || answerString.includes("price"))) {
      return quizResults["Mercado"]
    }

    // Farmácia: health + specialized + professional
    if (answerString.includes("health")) {
      return quizResults["Farmácia"]
    }

    // Cafeteria: meal + quick + cozy (se cozy)
    if (answerString.includes("meal") && answerString.includes("cozy")) {
      return quizResults["Cafeteria"]
    }

    // Lanchonete: meal + quick
    if (answerString.includes("meal") && answerString.includes("quick")) {
      return quizResults["Lanchonete"]
    }

    // Padaria: food + quick + cozy
    if (answerString.includes("food") && answerString.includes("quick")) {
      return quizResults["Padaria"]
    }

    // Restaurante: meal + specialized/professional
    if (answerString.includes("meal")) {
      return quizResults["Restaurante"]
    }

    // Default: Mercado
    return quizResults["Mercado"]
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setAnswers([])
    setIsComplete(false)
    setResult(null)
  }

  if (isComplete && result) {
    const ResultIcon = result.icon

    return (
      <Card className="p-8 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-purple-200">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>

          <h3 className="text-3xl font-bold text-gray-900 mb-2">
            Resultado do Quiz
          </h3>

          <Badge className="mb-6 bg-purple-600 text-white px-4 py-2 text-lg">
            <ResultIcon className="w-5 h-5 mr-2" />
            {result.name}
          </Badge>

          {isGeneratingImage && (
            <div className="mb-6 p-4 bg-white rounded-xl border-2 border-purple-200">
              <div className="flex items-center justify-center gap-3 text-purple-600">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span className="font-medium">Gerando imagem com IA...</span>
              </div>
            </div>
          )}

          {result.imageUrl && (
            <div className="mb-6 rounded-xl overflow-hidden border-4 border-white shadow-2xl">
              <img 
                src={result.imageUrl} 
                alt={result.name}
                className="w-full h-64 object-cover"
              />
            </div>
          )}

          <p className="text-gray-700 text-lg mb-8 max-w-2xl mx-auto">
            {result.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={resetQuiz}
              variant="outline"
              className="border-2 border-purple-300 hover:bg-purple-50"
            >
              Refazer Quiz
            </Button>
            <Button
              onClick={() => onComplete(result)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              Buscar {result.name}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const question = quizQuestions[currentQuestion]

  return (
    <Card className="p-8 bg-white border-2 border-gray-200">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600">
            Pergunta {currentQuestion + 1} de {quizQuestions.length}
          </span>
          <span className="text-sm font-medium text-purple-600">
            {Math.round(progress)}%
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <h3 className="text-2xl font-bold text-gray-900 mb-8 text-center">
        {question.question}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {question.options.map((option) => {
          const OptionIcon = option.icon
          return (
            <button
              key={option.value}
              onClick={() => handleAnswer(option.value)}
              className="p-6 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all duration-300 hover:scale-105 hover:shadow-lg text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <OptionIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-lg font-medium text-gray-900 group-hover:text-purple-600 transition-colors">
                  {option.text}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {currentQuestion > 0 && (
        <div className="mt-6 text-center">
          <Button
            onClick={() => {
              setCurrentQuestion(currentQuestion - 1)
              setAnswers(answers.slice(0, -1))
            }}
            variant="ghost"
            className="text-gray-600"
          >
            Voltar
          </Button>
        </div>
      )}
    </Card>
  )
}
