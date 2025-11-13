"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MapPin, TrendingDown, Store, ShoppingBag, Pill, Coffee, DollarSign, Navigation, Loader2, MapPinned, CheckCircle2, AlertCircle, Instagram, Globe, ExternalLink, User, LogOut, Sparkles, HelpCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAddressFromCEP, getCoordinatesFromCity, getCurrentLocation, type Coordinates } from "@/lib/geolocation"
import { searchNearbyPlaces, addRealProductsToPlaces, addMockProductsToPlaces, type StoreWithProducts, type Product } from "@/lib/places"
import { isAIConfigured } from "@/lib/ai-price-scraper"
import { getAuthState, logout, type User as UserType } from "@/lib/auth"
import { LoginDialog } from "@/components/custom/login-dialog"
import { searchCitiesWithCache, type CityOption } from "@/lib/city-autocomplete"
import { searchPlacesWithGoogle, isGoogleMapsConfigured } from "@/lib/google-places"
import { generateEstablishmentImage, isImageGenerationConfigured } from "@/lib/image-generator"
import { EstablishmentQuiz, type QuizResult } from "@/components/custom/establishment-quiz"

export default function Home() {
  const [location, setLocation] = useState("")
  const [searchResults, setSearchResults] = useState<StoreWithProducts[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string>("")
  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates | null>(null)
  const [currentCity, setCurrentCity] = useState<string>("")
  const [useRealPrices, setUseRealPrices] = useState(true)
  
  // Auth state
  const [user, setUser] = useState<UserType | null>(null)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  
  // City autocomplete
  const [citySuggestions, setCitySuggestions] = useState<CityOption[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null)

  // Verifica autenticação ao carregar e mostra dialog se não estiver logado
  useEffect(() => {
    const authState = getAuthState()
    if (authState.isAuthenticated && authState.user) {
      setUser(authState.user)
    } else {
      // Mostra o dialog de login assim que entrar no app
      setShowLoginDialog(true)
    }
  }, [])

  // Busca sugestões de cidades
  const handleLocationChange = async (value: string) => {
    setLocation(value)
    setError("")

    // Limpa timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Se for CEP, não mostra sugestões
    const isCEP = /^\d{5}-?\d{0,3}$/.test(value.trim())
    if (isCEP || value.length < 2) {
      setShowSuggestions(false)
      setCitySuggestions([])
      return
    }

    // Busca sugestões com debounce
    setIsLoadingSuggestions(true)
    searchTimeoutRef.current = setTimeout(async () => {
      const suggestions = await searchCitiesWithCache(value)
      setCitySuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
      setIsLoadingSuggestions(false)
    }, 300)
  }

  // Seleciona cidade da sugestão
  const handleSelectCity = (city: CityOption) => {
    setLocation(city.displayName)
    setShowSuggestions(false)
    setCitySuggestions([])
  }

  const categories = [
    { id: "all", name: "Todos", icon: Store },
    { id: "Mercado", name: "Mercados", icon: ShoppingBag },
    { id: "Farmácia", name: "Farmácias", icon: Pill },
    { id: "Lanchonete", name: "Lanchonetes", icon: Coffee },
    { id: "Cafeteria", name: "Cafeterias", icon: Coffee },
    { id: "Padaria", name: "Padarias", icon: Store },
  ]

  const handleSearch = async (categoryOverride?: string) => {
    const searchCategory = categoryOverride || selectedCategory
    
    if (!location.trim()) {
      setError("Digite um CEP ou cidade")
      return
    }
    
    setIsSearching(true)
    setError("")
    setShowSuggestions(false)
    setShowQuiz(false)
    
    try {
      let coordinates: Coordinates | null = null
      let cityName = ""

      // Verifica se é CEP (apenas números)
      const isCEP = /^\d{5}-?\d{3}$/.test(location.trim())

      if (isCEP) {
        // Busca por CEP
        const addressInfo = await getAddressFromCEP(location.trim())
        if (addressInfo) {
          coordinates = addressInfo.coordinates
          cityName = addressInfo.city
        } else {
          setError("CEP não encontrado. Tente novamente.")
          setIsSearching(false)
          return
        }
      } else {
        // Busca por cidade (extrai apenas o nome da cidade se tiver " - UF")
        const cityParts = location.trim().split(" - ")
        const cityToSearch = cityParts[0]
        const stateToSearch = cityParts[1] || undefined
        
        coordinates = await getCoordinatesFromCity(cityToSearch, stateToSearch)
        cityName = cityToSearch
        if (!coordinates) {
          setError("Cidade não encontrada. Tente novamente.")
          setIsSearching(false)
          return
        }
      }

      setCurrentCoordinates(coordinates)
      setCurrentCity(cityName)

      // Tenta buscar com Google Places API primeiro (mais preciso)
      let places: any[] = []
      
      if (isGoogleMapsConfigured() && searchCategory !== "all") {
        console.log("🗺️ Buscando com Google Places API (alta precisão)...")
        const googlePlaces = await searchPlacesWithGoogle(coordinates, searchCategory, 5000)
        
        if (googlePlaces.length > 0) {
          // Converte resultados do Google Places para nosso formato
          places = googlePlaces.map(place => ({
            id: place.id,
            name: place.name,
            address: place.address,
            type: place.type,
            distance: calculateDistance(coordinates, place.location),
            socialMedia: {
              website: place.website,
            },
            rating: place.rating,
            totalRatings: place.totalRatings,
            photos: place.photos,
          }))
        }
      }
      
      // Fallback para busca padrão se Google Places não retornar resultados
      if (places.length === 0) {
        console.log("📍 Usando busca padrão...")
        places = await searchNearbyPlaces(coordinates, 5)
      }
      
      // SEMPRE busca preços reais com IA
      const placesWithProducts = await addRealProductsToPlaces(places, cityName)
      
      setSearchResults(placesWithProducts)
      
      if (placesWithProducts.length === 0) {
        setError("Nenhum estabelecimento encontrado nesta região.")
      }
    } catch (err) {
      console.error("Erro na busca:", err)
      setError("Erro ao buscar estabelecimentos. Tente novamente.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleUseCurrentLocation = async () => {
    setIsSearching(true)
    setError("")
    setLocation("Detectando sua localização...")

    try {
      const coordinates = await getCurrentLocation()
      
      if (!coordinates) {
        setError("Não foi possível obter sua localização. Por favor, permita o acesso à localização nas configurações do navegador e tente novamente.")
        setLocation("")
        setIsSearching(false)
        return
      }

      setCurrentCoordinates(coordinates)
      setLocation("📍 Sua localização atual")
      
      // Tenta obter nome da cidade via reverse geocoding
      const cityName = "sua região"
      setCurrentCity(cityName)

      // Busca estabelecimentos próximos
      const places = await searchNearbyPlaces(coordinates, 5)
      
      // SEMPRE busca preços reais com IA
      const placesWithProducts = await addRealProductsToPlaces(places, cityName)
      
      setSearchResults(placesWithProducts)
      
      if (placesWithProducts.length === 0) {
        setError("Nenhum estabelecimento encontrado próximo a você.")
      }
    } catch (err) {
      console.error("Erro ao obter localização:", err)
      setError("Não foi possível obter sua localização. Por favor, permita o acesso à localização nas configurações do navegador e tente novamente.")
      setLocation("")
    } finally {
      setIsSearching(false)
    }
  }

  const handleLogout = () => {
    logout()
    setUser(null)
    setShowLoginDialog(true)
  }

  const handleLoginSuccess = (loggedUser: UserType) => {
    setUser(loggedUser)
  }

  const handleQuizComplete = (result: QuizResult) => {
    setQuizResult(result)
    setSelectedCategory(result.type)
    
    // Se já tem localização, busca automaticamente
    if (location.trim()) {
      handleSearch(result.type)
    }
  }

  const handleGenerateImage = async (type: string): Promise<string | null> => {
    if (!isImageGenerationConfigured()) {
      return null
    }

    try {
      const image = await generateEstablishmentImage(type)
      return image?.url || null
    } catch (error) {
      console.error("Erro ao gerar imagem:", error)
      return null
    }
  }

  const calculateDistance = (coord1: Coordinates, coord2: { lat: number; lng: number }): number => {
    const R = 6371 // Raio da Terra em km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return Math.round(R * c * 10) / 10
  }

  const filteredStores = selectedCategory === "all" 
    ? searchResults 
    : searchResults.filter(store => store.type === selectedCategory)

  // Encontra o menor preço para cada produto
  const findBestPrice = (productName: string) => {
    const allProducts = searchResults.flatMap(store => store.products)
    const sameProducts = allProducts.filter(p => p.name === productName)
    if (sameProducts.length === 0) return null
    return Math.min(...sameProducts.map(p => p.price))
  }

  // Verifica se há preços reais nos resultados
  const hasRealPrices = searchResults.some(store => 
    store.products.some(product => product.isReal)
  )

  // Função para abrir loja em nova aba
  const handleOpenStore = (store: StoreWithProducts) => {
    // Prioridade: website > instagram > busca no Google
    let url = ""
    
    if (store.socialMedia?.website) {
      url = store.socialMedia.website
    } else if (store.socialMedia?.instagram) {
      const instagramHandle = store.socialMedia.instagram.replace('@', '').replace('https://instagram.com/', '')
      url = `https://instagram.com/${instagramHandle}`
    } else {
      // Busca no Google Maps
      const searchQuery = encodeURIComponent(`${store.name} ${store.address}`)
      url = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`
    }
    
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  PreçoFácil
                </h1>
                <p className="text-xs text-gray-600">Preços reais com IA + Google Maps</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* User Menu */}
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 hidden sm:inline">
                    Olá, {user.name}
                  </span>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowLoginDialog(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <User className="w-4 h-4" />
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto text-center mb-8">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Preços Reais com{" "}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Inteligência Artificial
            </span>
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Nossa IA busca preços atualizados com precisão do Google Maps
          </p>

          {/* Quiz Button */}
          {!showQuiz && searchResults.length === 0 && (
            <div className="mb-6">
              <Button
                onClick={() => setShowQuiz(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-2xl shadow-lg transition-all duration-300 hover:scale-105"
              >
                <HelpCircle className="w-6 h-6 mr-2" />
                Não sabe o que procura? Faça nosso Quiz!
              </Button>
            </div>
          )}

          {/* Quiz Component */}
          {showQuiz && (
            <div className="mb-8">
              <EstablishmentQuiz 
                onComplete={handleQuizComplete}
                onGenerateImage={handleGenerateImage}
              />
            </div>
          )}

          {/* Search Bar */}
          {!showQuiz && (
            <div className="flex flex-col gap-3 max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <Input
                    type="text"
                    placeholder="Digite seu CEP ou cidade..."
                    value={location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    onFocus={() => citySuggestions.length > 0 && setShowSuggestions(true)}
                    className="pl-12 h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-2xl shadow-lg"
                  />
                  
                  {/* City Suggestions Dropdown */}
                  {showSuggestions && citySuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                      {citySuggestions.map((city) => (
                        <button
                          key={city.id}
                          onClick={() => handleSelectCity(city)}
                          className="w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-purple-600" />
                            <span className="text-gray-900">{city.displayName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {isLoadingSuggestions && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleSearch()}
                  disabled={isSearching}
                  className="h-14 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl shadow-lg transition-all duration-300 hover:scale-105"
                >
                  {isSearching ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Buscando com IA...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Search className="w-5 h-5" />
                      Buscar
                    </div>
                  )}
                </Button>
              </div>

              {/* Use Current Location Button */}
              <Button
                onClick={handleUseCurrentLocation}
                disabled={isSearching}
                variant="outline"
                className="h-12 border-2 border-purple-300 hover:bg-purple-50 rounded-xl transition-all duration-300"
              >
                <MapPinned className="w-5 h-5 mr-2" />
                Usar minha localização atual
              </Button>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Quiz Result Badge */}
              {quizResult && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 text-purple-700">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">
                      Buscando: {quizResult.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categories */}
        {searchResults.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {categories.map((category) => {
              const Icon = category.icon
              const isActive = selectedCategory === category.id
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105"
                      : "bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {category.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {filteredStores.length} {filteredStores.length === 1 ? "local encontrado" : "locais encontrados"}
              </h3>
              <div className="flex gap-2">
                {hasRealPrices && (
                  <Badge className="bg-green-100 text-green-700 px-4 py-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Preços Reais
                  </Badge>
                )}
                {isGoogleMapsConfigured() && (
                  <Badge className="bg-blue-100 text-blue-700 px-4 py-2 text-sm">
                    <Navigation className="w-4 h-4 mr-2" />
                    Google Maps
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredStores.map((store) => (
                <Card key={store.id} className="overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-2 border-gray-100">
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 text-white">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold mb-1">{store.name}</h4>
                        <p className="text-blue-100 text-sm">{store.type}</p>
                      </div>
                      <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30">
                        {store.distance} km
                      </Badge>
                    </div>
                    <p className="text-blue-100 text-sm flex items-center gap-1 mb-3">
                      <MapPin className="w-4 h-4" />
                      {store.address}
                    </p>
                    
                    {/* Social Media Links + Visit Store Button */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex gap-2">
                        {store.socialMedia?.instagram && (
                          <a 
                            href={store.socialMedia.instagram.startsWith('http') ? store.socialMedia.instagram : `https://instagram.com/${store.socialMedia.instagram.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/80 hover:text-white transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Instagram className="w-4 h-4" />
                          </a>
                        )}
                        {store.socialMedia?.website && (
                          <a 
                            href={store.socialMedia.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/80 hover:text-white transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => handleOpenStore(store)}
                        size="sm"
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Visitar
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 bg-white">
                    <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      Produtos disponíveis
                    </h5>
                    <div className="space-y-3">
                      {store.products.map((product) => {
                        const bestPrice = findBestPrice(product.name)
                        const isBestPrice = bestPrice === product.price
                        
                        return (
                          <div
                            key={product.id}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              isBestPrice
                                ? "bg-green-50 border-green-300"
                                : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">
                                  {product.name}
                                </p>
                                {product.isReal && product.source && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                    <ExternalLink className="w-3 h-3" />
                                    {product.source}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-gray-900">
                                  R$ {product.price.toFixed(2)}
                                </p>
                                {isBestPrice && (
                                  <Badge className="bg-green-600 text-white text-xs mt-1">
                                    Melhor preço!
                                  </Badge>
                                )}
                                {product.isReal && (
                                  <Badge className="bg-blue-600 text-white text-xs mt-1">
                                    Preço Real
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {product.lastUpdated && (
                              <p className="text-xs text-gray-400 mt-1">
                                Atualizado: {product.lastUpdated}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {searchResults.length === 0 && !isSearching && !error && !showQuiz && (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Search className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Pronto para economizar?
            </h3>
            <p className="text-gray-600 text-lg">
              Digite seu CEP ou cidade acima para encontrar os melhores preços perto de você
            </p>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-3">
          <div className="text-center p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Google Maps</h4>
            <p className="text-gray-600">
              Busca precisa de estabelecimentos usando a API do Google Maps
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Quiz Inteligente</h4>
            <p className="text-gray-600">
              Não sabe o que procura? Nosso quiz com IA te ajuda a decidir
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
              <TrendingDown className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Preços Reais</h4>
            <p className="text-gray-600">
              IA busca preços atualizados nas redes sociais e sites
            </p>
          </div>
        </div>
      </section>

      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  )
}
