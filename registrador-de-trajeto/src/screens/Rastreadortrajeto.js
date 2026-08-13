import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

// Fallback visual para Web ou ambientes sem react-native-maps nativo
let MapView, Polyline, Marker;
try {
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Polyline = Maps.Polyline;
  Marker = Maps.Marker;
} catch (e) {
  MapView = null;
}

// --- Funções Auxiliares (Fora do componente para evitar recriação) ---

// Fórmula de Haversine para calcular distância (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Formatação de tempo (HH:MM:SS)
function formatTime(seconds) {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

// Retorna o texto e a cor do badge de acordo com o estado do app
function getStatusInfo(isRecording, isPaused) {
  if (!isRecording) return { text: "⏹️ Parado", bg: "#3A2521" };
  if (isPaused) return { text: "⏸️ Pausado", bg: "#F59E0B" };
  return { text: "🔴 Gravando Trajeto...", bg: "#EF4444" };
}

export default function Rastreadortrajeto() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [locationHistory, setLocationHistory] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const locationSubscription = useRef(null);
  const timerRef = useRef(null);
  const mapRef = useRef(null);
  const lastPointRef = useRef(null);

  // Solicitar permissão ao carregar o componente
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setHasPermission(false);
        Alert.alert(
          "Permissão necessária",
          "A permissão de localização é necessária para registrar o trajeto.",
        );
        return;
      }
      setHasPermission(true);

      try {
        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation(initialLoc.coords);
      } catch (err) {
        console.warn("Erro ao obter posição inicial:", err);
      }
    })();

    return () => {
      stopTracking();
      stopTimer();
    };
  }, []);

  // Timers
  const startTimer = () => {
    stopTimer();
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

  // Monitoramento GPS
  const startTracking = async () => {
    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          const { latitude, longitude, speed } = loc.coords;
          const newPoint = { latitude, longitude, timestamp: loc.timestamp };

          setCurrentLocation(loc.coords);
          setCurrentSpeed(speed ? Math.max(0, speed * 3.6) : 0);

          if (lastPointRef.current) {
            const dist = calculateDistance(
              lastPointRef.current.latitude,
              lastPointRef.current.longitude,
              latitude,
              longitude,
            );

            if (dist > 0.002) {
              setTotalDistance((prev) => prev + dist);
              setLocationHistory((prev) => [...prev, newPoint]);
              lastPointRef.current = newPoint;
            }
          } else {
            lastPointRef.current = newPoint;
            setLocationHistory((prev) => [...prev, newPoint]);
          }

          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              1000,
            );
          }
        },
      );
    } catch (err) {
      console.error("Erro ao iniciar rastreamento:", err);
      Alert.alert("Erro", "Não foi possível iniciar o rastreamento GPS.");
    }
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  };

  // Handlers dos botões
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
    Alert.alert(
      "Trajeto Finalizado",
      `Distância total: ${totalDistance.toFixed(2)} km\nTempo: ${formatTime(
        elapsedTime,
      )}`,
    );
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
    lastPointRef.current = null;
  };

  // Região inicial do Mapa
  const initialRegion = {
    latitude: currentLocation?.latitude ?? -23.55052,
    longitude: currentLocation?.longitude ?? -46.633308,
    latitudeDelta: currentLocation ? 0.01 : 0.05,
    longitudeDelta: currentLocation ? 0.01 : 0.05,
  };

  const statusInfo = getStatusInfo(isRecording, isPaused);

  return (
    <SafeAreaView style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>🔥 Registrador de Trajeto</Text>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          <Text style={styles.statusText}>{statusInfo.text}</Text>
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

      {/* Exibição do Mapa ou Fallback Web */}
      <View style={styles.mapContainer}>
        {MapView && Platform.OS !== "web" ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation
            followsUserLocation
          >
            {locationHistory.length > 1 && (
              <Polyline
                coordinates={locationHistory}
                strokeColor="#FF4500"
                strokeWidth={5}
              />
            )}
            {locationHistory.length > 0 && (
              <Marker
                coordinate={locationHistory[0]}
                title="Ponto Inicial"
                pinColor="orange"
              />
            )}
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
            <Text style={styles.webFallbackTitle}>
              🗺️ Visualização do Trajeto
            </Text>
            <Text style={styles.webFallbackText}>
              {currentLocation
                ? `Coordenada Atual: ${currentLocation.latitude.toFixed(
                    5,
                  )}, ${currentLocation.longitude.toFixed(5)}`
                : "Obtendo sinal GPS..."}
            </Text>
            <Text style={styles.webFallbackSub}>
              Pontos Registrados: {locationHistory.length}
            </Text>
            {locationHistory.length > 0 && (
              <ScrollView style={styles.historyList}>
                {locationHistory.slice(-5).map((pt, idx) => (
                  <Text key={idx} style={styles.historyItem}>
                    #{idx + 1}: {pt.latitude.toFixed(5)},{" "}
                    {pt.longitude.toFixed(5)}
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
            <TouchableOpacity
              style={[
                styles.button,
                styles.flex1,
                isPaused ? styles.btnResume : styles.btnPause,
              ]}
              onPress={isPaused ? handleResume : handlePause}
            >
              <Text style={styles.btnText}>
                {isPaused ? "▶️ Retomar" : "⏸️ Pausar"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.btnStop, styles.flex1, styles.ml8]}
              onPress={handleStop}
            >
              <Text style={styles.btnText}>⏹️ Finalizar</Text>
            </TouchableOpacity>
          </View>
        )}

        {(locationHistory.length > 0 || elapsedTime > 0) && !isRecording && (
          <TouchableOpacity
            style={[styles.button, styles.btnReset, styles.mt12]}
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
    backgroundColor: "#120E0E",
  },
  flex1: {
    flex: 1,
  },
  ml8: {
    marginLeft: 8,
  },
  mt12: {
    marginTop: 12,
  },
  headerCard: {
    backgroundColor: "#1C1412",
    padding: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#3A2521",
    elevation: 6,
    shadowColor: "#FF4500",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF7ED",
    textAlign: "center",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 13,
  },
  metricsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#120E0E",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A1B18",
  },
  metricBox: {
    alignItems: "center",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F97316",
  },
  metricLabel: {
    fontSize: 12,
    color: "#FDBA74",
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#3A2521",
  },
  mapContainer: {
    flex: 1,
    marginVertical: 10,
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#3A2521",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  webFallbackContainer: {
    flex: 1,
    backgroundColor: "#1C1412",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 16,
  },
  webFallbackTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F97316",
    marginBottom: 8,
  },
  webFallbackText: {
    fontSize: 14,
    color: "#FFF7ED",
    marginVertical: 4,
  },
  webFallbackSub: {
    fontSize: 13,
    color: "#FDBA74",
    marginTop: 4,
  },
  historyList: {
    maxHeight: 120,
    marginTop: 12,
    width: "100%",
  },
  historyItem: {
    color: "#FED7AA",
    fontSize: 12,
    textAlign: "center",
    marginVertical: 2,
  },
  controlsCard: {
    backgroundColor: "#1C1412",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: "#3A2521",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnStart: {
    backgroundColor: "#F97316",
  },
  btnPause: {
    backgroundColor: "#F59E0B",
  },
  btnResume: {
    backgroundColor: "#EA580C",
  },
  btnStop: {
    backgroundColor: "#DC2626",
  },
  btnReset: {
    backgroundColor: "#2A1B18",
    borderWidth: 1,
    borderColor: "#3A2521",
  },
  btnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  btnTextReset: {
    color: "#FDBA74",
    fontWeight: "600",
    fontSize: 14,
  },
});
