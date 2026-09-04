// Módulo de Consulta Meteorológica accesible y simplificado para personas mayores
// Utiliza la API pública y gratuita de Open-Meteo (sin necesidad de API keys)

export interface WeatherLocation {
  name: string;
  admin1?: string; // Provincia / Comunidad
  country: string;
  latitude: number;
  longitude: number;
}

export interface DayForecast {
  date: string;
  dayName: string; // "Hoy", "Mañana", "Jueves", etc.
  weatherCode: number;
  conditionText: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  rainProb: number;
}

export interface WeatherData {
  currentTemp: number;
  apparentTemp: number;
  weatherCode: number;
  conditionText: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  tempMax: number;
  tempMin: number;
  rainProb: number;
  seniorTip: string;
  forecast: DayForecast[];
  locationName: string;
}

export const POPULAR_LOCATIONS: WeatherLocation[] = [
  { name: 'Madrid', admin1: 'Comunidad de Madrid', country: 'España', latitude: 40.4168, longitude: -3.7038 },
  { name: 'Barcelona', admin1: 'Cataluña', country: 'España', latitude: 41.3851, longitude: 2.1734 },
  { name: 'Valencia', admin1: 'Comunidad Valenciana', country: 'España', latitude: 39.4699, longitude: -0.3763 },
  { name: 'Sevilla', admin1: 'Andalucía', country: 'España', latitude: 37.3891, longitude: -5.9845 },
  { name: 'Zaragoza', admin1: 'Aragón', country: 'España', latitude: 41.6488, longitude: -0.8891 },
  { name: 'Málaga', admin1: 'Andalucía', country: 'España', latitude: 36.7213, longitude: -4.4214 },
  { name: 'Murcia', admin1: 'Región de Murcia', country: 'España', latitude: 37.9922, longitude: -1.1307 },
  { name: 'Palma', admin1: 'Islas Baleares', country: 'España', latitude: 39.5696, longitude: 2.6502 },
  { name: 'Bilbao', admin1: 'País Vasco', country: 'España', latitude: 43.2630, longitude: -2.9350 },
  { name: 'Alicante', admin1: 'Comunidad Valenciana', country: 'España', latitude: 38.3452, longitude: -0.4810 },
  { name: 'Valladolid', admin1: 'Castilla y León', country: 'España', latitude: 41.6523, longitude: -4.7245 },
  { name: 'Vigo', admin1: 'Galicia', country: 'España', latitude: 42.2406, longitude: -8.7207 },
  { name: 'Gijón', admin1: 'Asturias', country: 'España', latitude: 43.5357, longitude: -5.6615 },
  { name: 'Granada', admin1: 'Andalucía', country: 'España', latitude: 37.1773, longitude: -3.5986 },
  { name: 'Toledo', admin1: 'Castilla-La Mancha', country: 'España', latitude: 39.8628, longitude: -4.0273 },
  { name: 'Salamanca', admin1: 'Castilla y León', country: 'España', latitude: 40.9701, longitude: -5.6635 },
];

export function getWeatherCondition(code: number): { text: string; icon: string } {
  switch (code) {
    case 0:
      return { text: 'Soleado y despejado', icon: '☀️' };
    case 1:
      return { text: 'Mayormente despejado', icon: '🌤️' };
    case 2:
      return { text: 'Parcialmente nublado', icon: '⛅' };
    case 3:
      return { text: 'Nublado', icon: '☁️' };
    case 45:
    case 48:
      return { text: 'Niebla', icon: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { text: 'Llovizna suave', icon: '🌦️' };
    case 61:
    case 63:
    case 65:
      return { text: 'Lluvia', icon: '🌧️' };
    case 66:
    case 67:
      return { text: 'Lluvia helada', icon: '🌨️' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { text: 'Nieve', icon: '❄️' };
    case 80:
    case 81:
    case 82:
      return { text: 'Chubascos de lluvia', icon: '🌧️' };
    case 85:
    case 86:
      return { text: 'Chubascos de nieve', icon: '🌨️' };
    case 95:
    case 96:
    case 99:
      return { text: 'Tormenta eléctrica', icon: '⛈️' };
    default:
      return { text: 'Variable', icon: '⛅' };
  }
}

export function getSeniorWeatherTip(temp: number, rainProb: number, weatherCode: number): string {
  if (rainProb >= 50 || [61, 63, 65, 80, 81, 82, 95].includes(weatherCode)) {
    return '☔ Lleva paraguas si sales a la calle, hay probabilidad de lluvia.';
  }
  if (temp >= 32) {
    return '🥤 Mucho calor: Bebe agua con frecuencia y procura no salir en las horas centrales.';
  }
  if (temp >= 24) {
    return '☀️ Día cálido y agradable: Perfecto para dar un paseo temprano o a la sombra.';
  }
  if (temp >= 16) {
    return '⛅ Temperatura suave: Ropa de entretiempo cómoda.';
  }
  if (temp >= 10) {
    return '🧥 Hace fresquito: No olvides ponerte una chaqueta o rebeca al salir.';
  }
  return '🧣 Día frío: Abrígate bien con bufanda y abrigo si sales a la calle.';
}

export async function fetchWeather(location: WeatherLocation): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('No se pudo obtener el pronóstico del tiempo');
  }

  const data = await res.json();
  const current = data.current;
  const daily = data.daily;

  const currentCode = current.weather_code ?? 0;
  const currentCondition = getWeatherCondition(currentCode);
  const currentTemp = Math.round(current.temperature_2m);
  const apparentTemp = Math.round(current.apparent_temperature);
  const tempMax = Math.round(daily.temperature_2m_max?.[0] ?? currentTemp);
  const tempMin = Math.round(daily.temperature_2m_min?.[0] ?? currentTemp);
  const rainProb = daily.precipitation_probability_max?.[0] ?? 0;

  const daysNames = ['Hoy', 'Mañana', 'Pasado mañana'];
  const forecast: DayForecast[] = (daily.time || []).map((dateStr: string, idx: number) => {
    const code = daily.weather_code?.[idx] ?? 0;
    const cond = getWeatherCondition(code);
    return {
      date: dateStr,
      dayName: daysNames[idx] || new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long' }),
      weatherCode: code,
      conditionText: cond.text,
      icon: cond.icon,
      tempMax: Math.round(daily.temperature_2m_max?.[idx] ?? 0),
      tempMin: Math.round(daily.temperature_2m_min?.[idx] ?? 0),
      rainProb: daily.precipitation_probability_max?.[idx] ?? 0,
    };
  });

  return {
    currentTemp,
    apparentTemp,
    weatherCode: currentCode,
    conditionText: currentCondition.text,
    icon: currentCondition.icon,
    humidity: Math.round(current.relative_humidity_2m ?? 50),
    windSpeed: Math.round(current.wind_speed_10m ?? 0),
    tempMax,
    tempMin,
    rainProb,
    seniorTip: getSeniorWeatherTip(currentTemp, rainProb, currentCode),
    forecast,
    locationName: location.name,
  };
}

export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  if (!query || query.trim().length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=es&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  if (!data.results) return [];

  return data.results.map((r: any) => ({
    name: r.name,
    admin1: r.admin1 || r.country,
    country: r.country || 'España',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}
