/**
 * 天气小组件 - 复刻 Myriad WeatherWidget
 * 支持 2x2, 4x1, 4x2 三种尺寸
 */

// ==================== 常量 ====================

const CACHE_KEYS = {
  LOCATION: 'weather_location',
  WEATHER: 'weather_data'
};

const CACHE_TTL = {
  LOCATION: 24 * 60 * 60 * 1000,  // 24小时
  WEATHER: 30 * 60 * 1000         // 30分钟
};

// WMO 天气代码映射
const WEATHER_CODES = {
  0: { text: '晴', icon: '☀️', color: '#f59e0b' },
  1: { text: '晴', icon: '🌤️', color: '#f59e0b' },
  2: { text: '多云', icon: '⛅', color: '#6b7280' },
  3: { text: '阴', icon: '☁️', color: '#6b7280' },
  45: { text: '雾', icon: '🌫️', color: '#9ca3af' },
  48: { text: '雾', icon: '🌫️', color: '#9ca3af' },
  51: { text: '小雨', icon: '🌧️', color: '#3b82f6' },
  53: { text: '小雨', icon: '🌧️', color: '#3b82f6' },
  55: { text: '小雨', icon: '🌧️', color: '#3b82f6' },
  56: { text: '冻雨', icon: '🌨️', color: '#3b82f6' },
  57: { text: '冻雨', icon: '🌨️', color: '#3b82f6' },
  61: { text: '小雨', icon: '🌧️', color: '#3b82f6' },
  63: { text: '中雨', icon: '🌧️', color: '#3b82f6' },
  65: { text: '大雨', icon: '🌧️', color: '#3b82f6' },
  66: { text: '冻雨', icon: '🌨️', color: '#3b82f6' },
  67: { text: '冻雨', icon: '🌨️', color: '#3b82f6' },
  71: { text: '小雪', icon: '🌨️', color: '#6366f1' },
  73: { text: '中雪', icon: '🌨️', color: '#6366f1' },
  75: { text: '大雪', icon: '❄️', color: '#6366f1' },
  77: { text: '雨夹雪', icon: '🌨️', color: '#6366f1' },
  80: { text: '阵雨', icon: '🌦️', color: '#3b82f6' },
  81: { text: '阵雨', icon: '🌦️', color: '#3b82f6' },
  82: { text: '暴雨', icon: '⛈️', color: '#3b82f6' },
  85: { text: '阵雪', icon: '🌨️', color: '#6366f1' },
  86: { text: '暴雪', icon: '❄️', color: '#6366f1' },
  95: { text: '雷暴', icon: '⛈️', color: '#8b5cf6' },
  96: { text: '雷暴', icon: '⛈️', color: '#8b5cf6' },
  99: { text: '雷暴', icon: '⛈️', color: '#8b5cf6' }
};

// ==================== 工具函数 ====================

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { text: '未知', icon: '❓', color: '#10b981' };
}

function formatTemp(temp) {
  return Math.round(temp) + '°';
}

function formatWeekday(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[new Date(dateStr).getDay()];
}

// ==================== 数据获取 ====================

async function getLocation() {
  // 检查缓存
  const cached = await Tapp.storage.get(CACHE_KEYS.LOCATION);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL.LOCATION)) {
    console.log('[Weather] Using cached location:', cached.city);
    return cached;
  }

  console.log('[Weather] Fetching new location...');

  // 方案1: 使用内置 geo API
  try {
    const data = await Tapp.api('getClientGeo');
    if (data && data.lat && data.lon) {
      const location = {
        lat: data.lat,
        lon: data.lon,
        city: data.city || data.region || data.country || '未知位置',
        timestamp: Date.now()
      };
      await Tapp.storage.set(CACHE_KEYS.LOCATION, location);
      console.log('[Weather] Location from builtin geo:', location.city);
      return location;
    }
  } catch (error) {
    console.warn('[Weather] Builtin geo failed:', error);
  }

  // 方案2: 使用 ipapi.co 备用
  try {
    const data = await Tapp.api('getGeoByIP');
    if (data && data.latitude && data.longitude) {
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
  } catch (error) {
    console.warn('[Weather] ipapi.co fallback failed:', error);
  }

  console.error('[Weather] All location methods failed');
  return null;
}

async function getWeatherData(location, showAqi = true) {
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
  const [weatherData, aqiData] = await Promise.all([
    Tapp.api('getWeather', { lat: location.lat, lon: location.lon }),
    showAqi 
      ? Tapp.api('getAirQuality', { lat: location.lat, lon: location.lon }).catch(() => null)
      : Promise.resolve(null)
  ]);

  if (!weatherData || !weatherData.current) {
    throw new Error('Invalid weather data');
  }

  const current = weatherData.current;
  const daily = weatherData.daily;
  const weatherInfo = getWeatherInfo(current.weather_code);

  const result = {
    temperature: formatTemp(current.temperature_2m),
    weatherCode: current.weather_code,
    weather: weatherInfo.text,
    icon: weatherInfo.icon,
    color: weatherInfo.color,
    humidity: current.relative_humidity_2m,
    windSpeed: Math.round(current.wind_speed_10m),
    feelsLike: current.apparent_temperature ? Math.round(current.apparent_temperature) : null,
    aqi: aqiData?.current?.us_aqi || null,
    forecast: [],
    city: location.city,
    timestamp: Date.now()
  };

  // 解析预报数据
  if (daily && daily.time && daily.weather_code) {
    result.forecast = daily.time.slice(0, 4).map((date, i) => {
      const info = getWeatherInfo(daily.weather_code[i]);
      return {
        date,
        icon: info.icon,
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i])
      };
    });
  }

  // 保存缓存
  await Tapp.storage.set(cacheKey, result);
  return result;
}

// ==================== UI 更新 ====================

function showLoading() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const error = document.getElementById('error');
  
  if (loading) loading.classList.remove('hidden');
  if (content) content.classList.add('hidden');
  if (error) error.classList.add('hidden');
}

function showError() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const error = document.getElementById('error');
  
  if (loading) loading.classList.add('hidden');
  if (content) content.classList.add('hidden');
  if (error) error.classList.remove('hidden');
}

function showContent() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const error = document.getElementById('error');
  
  if (loading) loading.classList.add('hidden');
  if (content) content.classList.remove('hidden');
  if (error) error.classList.add('hidden');
}

function updateGlow(color) {
  const glow = document.getElementById('glow');
  if (glow) {
    glow.style.setProperty('--theme-color', color);
    glow.style.background = color;
  }
}

function updateWidget2x2(data) {
  document.getElementById('icon').textContent = data.icon;
  document.getElementById('temp').textContent = data.temperature;
  document.getElementById('weather').textContent = data.weather;
  document.getElementById('city').textContent = data.city;
  document.getElementById('humidity').textContent = data.humidity + '%';
  document.getElementById('wind').textContent = data.windSpeed + 'km/h';
  updateGlow(data.color);
}

function updateWidget4x1(data) {
  document.getElementById('icon').textContent = data.icon;
  document.getElementById('temp').textContent = data.temperature;
  document.getElementById('weather').textContent = data.weather;
  document.getElementById('city').textContent = data.city;
  document.getElementById('humidity').textContent = data.humidity + '%';
  document.getElementById('wind').textContent = data.windSpeed;
  
  // 明天预报
  if (data.forecast && data.forecast.length > 1) {
    const tomorrow = data.forecast[1];
    document.getElementById('tomorrow-icon').textContent = tomorrow.icon;
    document.getElementById('tomorrow-max').textContent = tomorrow.maxTemp + '°';
    document.getElementById('tomorrow-min').textContent = tomorrow.minTemp + '°';
  }
  
  updateGlow(data.color);
}

function updateWidget4x2(data) {
  document.getElementById('icon').textContent = data.icon;
  document.getElementById('temp').textContent = data.temperature;
  document.getElementById('weather').textContent = data.weather;
  document.getElementById('city').textContent = data.city;
  document.getElementById('humidity').textContent = data.humidity + '%';
  document.getElementById('wind').textContent = data.windSpeed + 'km/h';
  
  // 体感温度
  const feelsLike = document.getElementById('feels-like');
  if (feelsLike && data.feelsLike !== null) {
    feelsLike.textContent = '体感 ' + data.feelsLike + '°';
  }
  
  // AQI
  const aqiItem = document.getElementById('aqi-item');
  if (aqiItem && data.aqi !== null) {
    aqiItem.classList.remove('hidden');
    const aqiIcon = document.getElementById('aqi-icon');
    const aqiText = document.getElementById('aqi');
    
    aqiIcon.textContent = data.aqi <= 50 ? '🌿' : data.aqi <= 100 ? '🌫️' : '😷';
    aqiText.textContent = 'AQI ' + data.aqi;
    aqiText.className = data.aqi <= 50 ? 'aqi-good' : 
                        data.aqi <= 100 ? 'aqi-moderate' : 
                        data.aqi <= 150 ? 'aqi-unhealthy' : 'aqi-very-unhealthy';
  }
  
  // 预报列表
  const forecastList = document.getElementById('forecast');
  if (forecastList && data.forecast && data.forecast.length > 0) {
    forecastList.innerHTML = data.forecast.slice(0, 3).map(day => `
      <div class="forecast-item">
        <div class="forecast-day">${formatWeekday(day.date)}</div>
        <div class="forecast-icon">${day.icon}</div>
        <div class="forecast-temps">
          <span class="forecast-max">${day.maxTemp}°</span>
          <span class="forecast-min">${day.minTemp}°</span>
        </div>
      </div>
    `).join('');
  }
  
  updateGlow(data.color);
}

// ==================== 初始化 ====================

async function initWidget(size) {
  console.log('[Weather] Widget init, size:', size);
  showLoading();
  
  try {
    const location = await getLocation();
    if (!location) {
      showError();
      return;
    }
    
    const showAqi = size === '4x2';
    const data = await getWeatherData(location, showAqi);
    
    if (size === '2x2') {
      updateWidget2x2(data);
    } else if (size === '4x1') {
      updateWidget4x1(data);
    } else if (size === '4x2') {
      updateWidget4x2(data);
    }
    
    showContent();
  } catch (error) {
    console.error('[Weather] Init failed:', error);
    showError();
  }
}

// ==================== 生命周期入口 ====================

(function() {
  var mode = window._TAPP_MODE;
  var size = window._TAPP_WIDGET_SIZE || '2x2';
  
  console.log('[Weather] Tapp initialized, mode:', mode, 'size:', size);
  
  if (mode === 'widget') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        initWidget(size);
      });
    } else {
      setTimeout(function() {
        initWidget(size);
      }, 0);
    }
  }
})();
