/**
 * Weather Plus Tapp - 天气动态应用
 * 
 * 完整独立实现，使用 Tapp SDK API
 * 支持：地理定位、天气获取、空气质量、多日预报
 */

// ==================== 常量定义 ====================

// 缓存键
const CACHE_KEYS = {
  LOCATION: 'weather_location',
  WEATHER: 'weather_data',
  SETTINGS: '_settings'
};

// 缓存时长（毫秒）
const CACHE_TTL = {
  LOCATION: 24 * 60 * 60 * 1000,  // 位置缓存24小时
  WEATHER: 30 * 60 * 1000         // 天气缓存30分钟
};

// WMO 天气代码映射 - 图标
const WEATHER_ICONS = {
  0: '☀️',   // 晴朗
  1: '🌤️',  // 大部晴朗
  2: '⛅',   // 部分多云
  3: '☁️',   // 阴天
  45: '🌫️', // 雾
  48: '🌫️', // 雾凇
  51: '🌦️', // 小毛毛雨
  53: '🌦️', // 中毛毛雨
  55: '🌦️', // 大毛毛雨
  56: '🌧️', // 冻毛毛雨（小）
  57: '🌧️', // 冻毛毛雨（大）
  61: '🌧️', // 小雨
  63: '🌧️', // 中雨
  65: '🌧️', // 大雨
  66: '🌧️', // 冻雨（小）
  67: '🌧️', // 冻雨（大）
  71: '🌨️', // 小雪
  73: '🌨️', // 中雪
  75: '❄️',  // 大雪
  77: '🌨️', // 雪粒
  80: '🌦️', // 小阵雨
  81: '🌧️', // 中阵雨
  82: '⛈️',  // 大阵雨
  85: '🌨️', // 小阵雪
  86: '❄️',  // 大阵雪
  95: '⛈️',  // 雷暴
  96: '⛈️',  // 雷暴+小冰雹
  99: '⛈️'   // 雷暴+大冰雹
};

// WMO 天气代码映射 - 文字描述
const WEATHER_TEXT = {
  0: '晴',
  1: '晴',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '雾',
  51: '小雨',
  53: '小雨',
  55: '小雨',
  56: '冻雨',
  57: '冻雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '阵雨',
  81: '阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '大雪',
  95: '雷暴',
  96: '雷暴',
  99: '雷暴'
};

// 天气代码对应的主题色
const WEATHER_COLORS = {
  sunny: '#f59e0b',      // 晴天 - 橙黄
  cloudy: '#6b7280',     // 多云 - 灰色
  foggy: '#9ca3af',      // 雾 - 浅灰
  rainy: '#3b82f6',      // 雨 - 蓝色
  snowy: '#6366f1',      // 雪 - 靛蓝
  stormy: '#8b5cf6'      // 雷暴 - 紫色
};

// ==================== 工具函数 ====================

/**
 * 根据天气代码获取图标
 */
function getWeatherIcon(code) {
  return WEATHER_ICONS[code] || '🌤️';
}

/**
 * 根据天气代码获取文字描述
 */
function getWeatherText(code) {
  return WEATHER_TEXT[code] || '未知';
}

/**
 * 根据天气代码获取主题色
 */
function getWeatherColor(code) {
  if (code === 0 || code === 1) return WEATHER_COLORS.sunny;
  if (code === 2 || code === 3) return WEATHER_COLORS.cloudy;
  if (code === 45 || code === 48) return WEATHER_COLORS.foggy;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return WEATHER_COLORS.rainy;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return WEATHER_COLORS.snowy;
  if (code >= 95 && code <= 99) return WEATHER_COLORS.stormy;
  return WEATHER_COLORS.sunny;
}

/**
 * 格式化温度
 */
function formatTemp(temp, units = 'celsius') {
  const rounded = Math.round(temp);
  if (units === 'fahrenheit') {
    const fahrenheit = Math.round(temp * 9 / 5 + 32);
    return `${fahrenheit}°F`;
  }
  return `${rounded}°C`;
}

/**
 * 格式化温度（仅数字）
 */
function formatTempValue(temp, units = 'celsius') {
  if (units === 'fahrenheit') {
    return Math.round(temp * 9 / 5 + 32);
  }
  return Math.round(temp);
}

/**
 * 获取 AQI 等级信息
 */
function getAqiInfo(aqi) {
  if (aqi <= 50) return { level: 'good', text: '优', color: '#22c55e', icon: '🌿' };
  if (aqi <= 100) return { level: 'moderate', text: '良', color: '#eab308', icon: '🌫️' };
  if (aqi <= 150) return { level: 'unhealthy-sensitive', text: '轻度污染', color: '#f97316', icon: '😷' };
  if (aqi <= 200) return { level: 'unhealthy', text: '中度污染', color: '#ef4444', icon: '😷' };
  if (aqi <= 300) return { level: 'very-unhealthy', text: '重度污染', color: '#7c3aed', icon: '⚠️' };
  return { level: 'hazardous', text: '严重污染', color: '#991b1b', icon: '☠️' };
}

/**
 * 格式化星期几
 */
function formatWeekday(dateStr, locale = 'zh-CN') {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

// ==================== 核心 API 函数 ====================

/**
 * 获取地理位置
 * 优先使用后端代理，失败后使用备用方案
 */
async function getLocation() {
  // 检查缓存
  const cached = await Tapp.storage.get(CACHE_KEYS.LOCATION);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL.LOCATION)) {
    console.log('[Weather] Using cached location:', cached.city);
    return cached;
  }

  console.log('[Weather] Fetching new location...');

  // 方案1: 使用后端代理获取客户端地理位置
  try {
    const response = await Tapp.api('getClientGeo');
    if (response.success && response.data) {
      const data = response.data;
      if (data.lat && data.lon) {
        const location = {
          lat: data.lat,
          lon: data.lon,
          city: data.city || data.regionName || data.country || '未知位置',
          timestamp: Date.now()
        };
        await Tapp.storage.set(CACHE_KEYS.LOCATION, location);
        console.log('[Weather] Location from backend proxy:', location.city);
        return location;
      }
    }
  } catch (error) {
    console.warn('[Weather] Backend proxy failed:', error);
  }

  // 方案2: 使用 ipapi.co 备用
  try {
    const response = await Tapp.api('getGeoByIP');
    if (response.success && response.data) {
      const data = response.data;
      if (data.latitude && data.longitude) {
        const location = {
          lat: data.latitude,
          lon: data.longitude,
          city: data.city || data.region || data.country_name || '未知位置',
          timestamp: Date.now()
        };
        await Tapp.storage.set(CACHE_KEYS.LOCATION, location);
        console.log('[Weather] Location from ipapi.co:', location.city);
        return location;
      }
    }
  } catch (error) {
    console.warn('[Weather] ipapi.co fallback failed:', error);
  }

  // 方案3: 浏览器地理位置 API（需要用户授权）
  if ('geolocation' in navigator) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 600000
        });
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // 反向地理编码获取城市名
      let city = '当前位置';
      try {
        const reverseResponse = await Tapp.api('reverseGeocode', { lat, lon });
        if (reverseResponse.success && reverseResponse.data) {
          const addr = reverseResponse.data.address;
          city = addr?.city || addr?.town || addr?.village || 
                 addr?.county || addr?.state || '当前位置';
        }
      } catch (e) {
        console.warn('[Weather] Reverse geocoding failed:', e);
      }

      const location = { lat, lon, city, timestamp: Date.now() };
      await Tapp.storage.set(CACHE_KEYS.LOCATION, location);
      console.log('[Weather] Location from browser:', location.city);
      return location;
    } catch (error) {
      console.warn('[Weather] Browser geolocation failed:', error);
    }
  }

  // 所有方案都失败，返回 null
  console.error('[Weather] All location methods failed');
  return null;
}

/**
 * 获取天气数据
 */
async function getWeatherData(location, settings = {}) {
  if (!location || !location.lat || !location.lon) {
    throw new Error('Invalid location');
  }

  const cacheKey = `${CACHE_KEYS.WEATHER}_${location.lat.toFixed(2)}_${location.lon.toFixed(2)}`;
  
  // 检查缓存
  const cached = await Tapp.storage.get(cacheKey);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL.WEATHER)) {
    console.log('[Weather] Using cached weather data');
    return cached;
  }

  console.log('[Weather] Fetching new weather data...');

  // 并行获取天气和空气质量
  const [weatherResponse, aqiResponse] = await Promise.all([
    Tapp.api('getWeather', { lat: location.lat, lon: location.lon }),
    settings.showAqi !== false 
      ? Tapp.api('getAirQuality', { lat: location.lat, lon: location.lon }).catch(() => null)
      : Promise.resolve(null)
  ]);

  if (!weatherResponse.success || !weatherResponse.data) {
    throw new Error('Failed to fetch weather data');
  }

  const weatherData = weatherResponse.data;
  const current = weatherData.current;
  const daily = weatherData.daily;

  if (!current) {
    throw new Error('No current weather data');
  }

  // 处理预报数据
  const forecast = [];
  if (daily && daily.time && daily.time.length > 0) {
    for (let i = 1; i < Math.min(daily.time.length, 5); i++) {
      forecast.push({
        date: daily.time[i],
        maxTemp: daily.temperature_2m_max[i],
        minTemp: daily.temperature_2m_min[i],
        weatherCode: daily.weather_code[i],
        icon: getWeatherIcon(daily.weather_code[i]),
        text: getWeatherText(daily.weather_code[i])
      });
    }
  }

  // 处理空气质量
  let aqi = null;
  if (aqiResponse && aqiResponse.success && aqiResponse.data?.current?.us_aqi) {
    aqi = aqiResponse.data.current.us_aqi;
  }

  const result = {
    city: location.city,
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    icon: getWeatherIcon(current.weather_code),
    text: getWeatherText(current.weather_code),
    color: getWeatherColor(current.weather_code),
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    feelsLike: current.apparent_temperature,
    aqi: aqi,
    aqiInfo: aqi ? getAqiInfo(aqi) : null,
    forecast: forecast,
    timestamp: Date.now()
  };

  // 缓存结果
  await Tapp.storage.set(cacheKey, result);
  console.log('[Weather] Weather data cached:', result.city, result.text);

  return result;
}

/**
 * 获取完整天气信息（位置 + 天气）
 */
async function getFullWeatherInfo() {
  const settings = await Tapp.settings.getAll() || {};
  
  const location = await getLocation();
  if (!location) {
    return { error: 'location_failed', message: '无法获取位置信息' };
  }

  try {
    const weather = await getWeatherData(location, settings);
    return {
      success: true,
      data: weather,
      settings: settings
    };
  } catch (error) {
    console.error('[Weather] Failed to get weather:', error);
    return { error: 'weather_failed', message: error.message || '获取天气失败' };
  }
}

// ==================== 全局导出 ====================

// 导出给小组件使用
window.WeatherPlus = {
  getFullWeatherInfo,
  getLocation,
  getWeatherData,
  formatTemp,
  formatTempValue,
  formatWeekday,
  getWeatherIcon,
  getWeatherText,
  getWeatherColor,
  getAqiInfo,
  CACHE_TTL
};

// 初始化
console.log('[Weather Plus] Tapp initialized');
