import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';

// Fallback visual para Web ou ambientes sem react-native-maps nativo
let MapView, Polyline, Marker;
try {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Polyline = Maps.Polyline;
  Marker = Maps.Marker;
} catch (e) {
  MapView = null;
}

const { width } = Dimensions.get('window');

// Função auxiliar para calcular distância entre duas coordenadas em km (Fórmula de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Rastreadortrajeto() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [locationHistory, setLocationHistory] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0); // em km
  const [elapsedTime, setElapsedTime] = useState(0); // em segundos
  const [currentSpeed, setCurrentSpeed] = useState(0); // em km/h

  const locationSubscription = useRef(null);
  const timerRef = useRef(null);
  const mapRef = useRef(null);

  // Solicitar permissão de localização ao carregar
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHasPermission(false);
        Alert.alert(
          'Permissão negada',
          'A permissão para acessar a localização em segundo plano/primeiro plano é necessária para registrar o trajeto.'
        );
        return;
      }
      setHasPermission(true);

      // Pegar localização atual
      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation(initialLoc.coords);
      } catch (err) {
        console.warn('Erro ao obter posição inicial:', err);
      }
    })();

    return () => {
      stopTracking();
      stopTimer();
    };
  }, []);

  // Timer do tempo decorrido
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Iniciar monitoramento GPS em tempo real
  const startTracking = async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000, // Atualiza a cada 2 segundos
          distanceInterval: 3, // Ou a cada 3 metros
        },
        (loc) => {
          const { latitude, longitude, speed } = loc.coords;
          const newPoint = { latitude, longitude, timestamp: loc.timestamp };

          setCurrentLocation(loc.coords);
          setCurrentSpeed(speed ? Math.max(0, speed * 3.6) : 0); // converter m/s para km/h

          setLocationHistory((prev) => {
            if (prev.length > 0) {
              const lastPoint = prev[prev.length - 1];
              const dist = calculateDistance(
                lastPoint.latitude,
                lastPoint.longitude,
                latitude,
                longitude
              );
              if (dist > 0.002) { // ignora pequenas oscilações menores que 2 metros
                setTotalDistance((prevDist) => prevDist + dist);
                return [...prev, newPoint];
              }
              return prev;
            }
            return [newPoint];
          });

          // Animar mapa para o ponto atual
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              1000
            );
          }
        }
      );
    } catch (err) {
      console.error('Erro ao iniciar rastreamento:', err);
      Alert.alert('Erro', 'Não foi possível iniciar o rastreamento GPS.');
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  // Ações dos botões
  const handleStart = () => {
    setIsRecording(true);
    setIsPaused(false);
    startTimer();
    startTracking();
  };

  const handlePause = () => {
    setIsPaused(true);
    stopTimer();
    stopTracking();
  };

  const handleResume = () => {
    setIsPaused(false);
    startTimer();
    startTracking();
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
    stopTimer();
    stopTracking();
    Alert.alert('Trajeto Finalizado', `Distância total: ${totalDistance.toFixed(2)} km\nTempo: ${formatTime(elapsedTime)}`);
  };

  const handleReset = () => {
    setIsRecording(false);
    setIsPaused(false);
    stopTimer();
    stopTracking();
    setLocationHistory([]);
    setTotalDistance(0);
    setElapsedTime(0);
    setCurrentSpeed(0);
  };

  // Formatação do tempo decorrido (HH:MM:SS)
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: -23.55052,
        longitude: -46.633308,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho de Status e Métricas */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>📍 Registrador de Trajeto</Text>
        <View style={styles.statusBadge(isRecording, isPaused)}>
          <Text style={styles.statusText}>
            {isRecording
              ? isPaused
                ? '⏸️ Pausado'
                : '🔴 Gravando Trajeto...'
              : '⏹️ Parado'}
          </Text>
        </View>

        <View style={styles.metricsContainer}>
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{totalDistance.toFixed(2)}</Text>
            <Text style={styles.metricLabel}>Distância (km)</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{formatTime(elapsedTime)}</Text>
            <Text style={styles.metricLabel}>Tempo</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricBox}>
            <Text style={styles.metricValue}>{currentSpeed.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Vel. (km/h)</Text>
          </View>
        </View>
      </View>

      {/* Exibição do Mapa ou Fallback */}
      <View style={styles.mapContainer}>
        {MapView && Platform.OS !== 'web' ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation
            followsUserLocation
          >
            {/* Linha do Trajeto */}
            {locationHistory.length > 1 && (
              <Polyline
                coordinates={locationHistory}
                strokeColor="#007AFF"
                strokeWidth={5}
              />
            )}

            {/* Marcador de Início */}
            {locationHistory.length > 0 && (
              <Marker
                coordinate={locationHistory[0]}
                title="Ponto Inicial"
                pinColor="green"
              />
            )}

            {/* Marcador Atual/Final */}
            {locationHistory.length > 1 && (
              <Marker
                coordinate={locationHistory[locationHistory.length - 1]}
                title="Posição Atual"
                pinColor="red"
              />
            )}
          </MapView>
        ) : (
          <View style={styles.webFallbackContainer}>
            <Text style={styles.webFallbackTitle}>🗺️ Visualização de Trajeto</Text>
            {currentLocation ? (
              <Text style={styles.webFallbackText}>
                Coordenada Atual: {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
            ) : (
              <Text style={styles.webFallbackText}>Obtendo sinal GPS...</Text>
            )}
            <Text style={styles.webFallbackSub}>
              Pontos Registrados: {locationHistory.length}
            </Text>
            {locationHistory.length > 0 && (
              <ScrollView style={styles.historyList}>
                {locationHistory.slice(-5).map((pt, idx) => (
                  <Text key={idx} style={styles.historyItem}>
                    #{idx + 1}: {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                  </Text>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Painel de Controles */}
      <View style={styles.controlsCard}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.button, styles.btnStart]}
            onPress={handleStart}
          >
            <Text style={styles.btnText}>▶️ Iniciar Trajeto</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.buttonRow}>
            {isPaused ? (
              <TouchableOpacity
                style={[styles.button, styles.btnResume, { flex: 1, marginRight: 8 }]}
                onPress={handleResume}
              >
                <Text style={styles.btnText}>▶️ Retomar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.btnPause, { flex: 1, marginRight: 8 }]}
                onPress={handlePause}
              >
                <Text style={styles.btnText}>⏸️ Pausar</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.btnStop, { flex: 1, marginLeft: 8 }]}
              onPress={handleStop}
            >
              <Text style={styles.btnText}>⏹️ Finalizar</Text>
            </TouchableOpacity>
          </View>
        )}

        {(locationHistory.length > 0 || elapsedTime > 0) && !isRecording && (
          <TouchableOpacity
            style={[styles.button, styles.btnReset, { marginTop: 12 }]}
            onPress={handleReset}
          >
            <Text style={styles.btnTextReset}>🔄 Limpar Dados</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusBadge: (isRecording, isPaused) => ({
    alignSelf: 'center',
    backgroundColor: isRecording
      ? isPaused
        ? '#EF4444'
        : '#22C55E'
      : '#64748B',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  }),
  statusText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 12,
  },
  metricBox: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#38BDF8',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
  },
  mapContainer: {
    flex: 1,
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 12,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  webFallbackContainer: {
    flex: 1,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
  },
  webFallbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#38BDF8',
    marginBottom: 8,
  },
  webFallbackText: {
    fontSize: 14,
    color: '#E2E8F0',
    marginVertical: 4,
  },
  webFallbackSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  historyList: {
    maxHeight: 120,
    marginTop: 12,
    width: '100%',
  },
  historyItem: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 2,
  },
  controlsCard: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStart: {
    backgroundColor: '#22C55E',
  },
  btnPause: {
    backgroundColor: '#EAB308',
  },
  btnResume: {
    backgroundColor: '#3B82F6',
  },
  btnStop: {
    backgroundColor: '#EF4444',
  },
  btnReset: {
    backgroundColor: '#334155',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnTextReset: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
});
