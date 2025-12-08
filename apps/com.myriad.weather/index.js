/**
 * Weather Tapp - 天气预报应用
 * 演示新的 Tapp.api() 声明式 API 调用系统
 */

// 天气图标映射
const weatherIcons = {
  '01d': '☀️', '01n': '🌙',    // 晴
  '02d': '⛅', '02n': '☁️',    // 少云
  '03d': '☁️', '03n': '☁️',    // 多云
  '04d': '☁️', '04n': '☁️',    // 阴
  '09d': '🌧️', '09n': '🌧️',   // 阵雨
  '10d': '🌦️', '10n': '🌧️',   // 雨
  '11d': '⛈️', '11n': '⛈️',    // 雷雨
  '13d': '🌨️', '13n': '🌨️',   // 雪
  '50d': '🌫️', '50n': '🌫️',   // 雾
};

// 获取天气图标
function getWeatherIcon(iconCode) {
  return weatherIcons[iconCode] || '🌤️';
}

// 格式化温度
function formatTemp(temp, units = 'metric') {
  const unit = units === 'metric' ? '°C' : '°F';
  return `${Math.round(temp)}${unit}`;
}

// 页面状态
let currentWeather = null;
let forecast = null;

// 初始化
async function init() {
  console.log('[Weather] Initializing...');
  
  // 获取设置
  const settings = await Tapp.storage.get('settings') || {};
  const units = settings.units || 'metric';
  
  // 加载天气数据
  await loadWeather(units);
  
  // 设置自动刷新
  const refreshInterval = (settings.refreshInterval || 30) * 60 * 1000;
  setInterval(() => loadWeather(units), refreshInterval);
}

// 加载天气数据
async function loadWeather(units = 'metric') {
  try {
    showLoading(true);
    
    // 使用新的 Tapp.api() 调用声明的 API
    // 后端会自动注入 geo（用户位置）和 secrets（API密钥）
    const response = await Tapp.api('getWeather', { units });
    
    if (response.success) {
      currentWeather = response.data;
      renderCurrentWeather(currentWeather, units);
    } else {
      showError(response.error || '获取天气失败');
    }
    
  } catch (error) {
    console.error('[Weather] Load failed:', error);
    showError('网络错误，请稍后重试');
  } finally {
    showLoading(false);
  }
}

// 加载天气预报
async function loadForecast(units = 'metric', count = 8) {
  try {
    const response = await Tapp.api('getForecast', { units, count });
    
    if (response.success) {
      forecast = response.data;
      renderForecast(forecast, units);
    } else {
      console.error('[Weather] Forecast failed:', response.error);
    }
  } catch (error) {
    console.error('[Weather] Forecast load failed:', error);
  }
}

// 渲染当前天气
function renderCurrentWeather(data, units) {
  const container = document.getElementById('current-weather');
  if (!container) return;
  
  const icon = getWeatherIcon(data.weather[0]?.icon);
  const temp = formatTemp(data.main.temp, units);
  const feelsLike = formatTemp(data.main.feels_like, units);
  const description = data.weather[0]?.description || '';
  const city = data.name;
  const humidity = data.main.humidity;
  const windSpeed = data.wind.speed;
  
  container.innerHTML = `
    <div class="weather-card">
      <div class="weather-location">${city}</div>
      <div class="weather-main">
        <span class="weather-icon">${icon}</span>
        <span class="weather-temp">${temp}</span>
      </div>
      <div class="weather-description">${description}</div>
      <div class="weather-details">
        <div class="detail-item">
          <span class="label">体感</span>
          <span class="value">${feelsLike}</span>
        </div>
        <div class="detail-item">
          <span class="label">湿度</span>
          <span class="value">${humidity}%</span>
        </div>
        <div class="detail-item">
          <span class="label">风速</span>
          <span class="value">${windSpeed} m/s</span>
        </div>
      </div>
    </div>
  `;
}

// 渲染天气预报
function renderForecast(data, units) {
  const container = document.getElementById('forecast');
  if (!container || !data.list) return;
  
  const items = data.list.slice(0, 8).map(item => {
    const time = new Date(item.dt * 1000);
    const hour = time.getHours().toString().padStart(2, '0') + ':00';
    const icon = getWeatherIcon(item.weather[0]?.icon);
    const temp = formatTemp(item.main.temp, units);
    
    return `
      <div class="forecast-item">
        <div class="forecast-time">${hour}</div>
        <div class="forecast-icon">${icon}</div>
        <div class="forecast-temp">${temp}</div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="forecast-title">未来24小时</div>
    <div class="forecast-list">${items}</div>
  `;
}

// 显示加载状态
function showLoading(loading) {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.display = loading ? 'flex' : 'none';
  }
}

// 显示错误
function showError(message) {
  const container = document.getElementById('current-weather');
  if (container) {
    container.innerHTML = `
      <div class="error-card">
        <span class="error-icon">⚠️</span>
        <span class="error-message">${message}</span>
        <button onclick="loadWeather()" class="retry-btn">重试</button>
      </div>
    `;
  }
}

// 刷新按钮点击
async function onRefresh() {
  const settings = await Tapp.storage.get('settings') || {};
  await loadWeather(settings.units || 'metric');
  await loadForecast(settings.units || 'metric');
}

// 暴露给页面的函数
window.onRefresh = onRefresh;

// 启动
init();
