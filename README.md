# 🚀 Registrador de Trajeto

Aplicativo mobile desenvolvido em **React Native** com **Expo** para rastreamento de trajeto em tempo real, cálculo de distância percorrida, tempo decorrido e velocidade atual com suporte a mapeamento em tempo real.

---

## 👥 Nome do Projeto e Integrantes

* **Nome do Projeto:** Registrador de Trajeto (GPS Tracker)
* **Integrantes:**
  * Eduardo Henrique de Jesus Chaves
  * Enzo Antônio de Ferreira Araújo
  * Heloísa Gabrielly Paixão
  * Pedro da Silva Andres Jimenez 

---

## 📡 Sensores Utilizados

* **Sensor de Localização (GPS - `expo-location`):**
  * Captura em tempo real as coordenadas geográficas (**Latitude** e **Longitude**) do dispositivo.
  * Obtém a velocidade instantânea do usuário (convertida de m/s para km/h).
  * Permite o cálculo da distância acumulada por meio da **Fórmula de Haversine**, aplicando um filtro para ignorar oscilações/ruídos do sinal GPS (deslocamentos menores que 2 metros).

---

## 🛠️ Como Rodar o Projeto

### Pré-requisitos
* **Node.js** instalado na sua máquina (versão LTS recomendada).
* Aplicativo **Expo Go** instalado no celular (disponível na Google Play Store / App Store) **OU** um emulador configurado (Android Studio / Xcode).

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone [https://github.com/seu-usuario/seu-repositorio.git](https://github.com/seu-usuario/seu-repositorio.git)
   cd seu-repositorio

2. **Instalar as dependências:**
   ```bash
   npm install

3. **Executar a aplicação:**
   ```bash
   npx expo start

4. **Visualizar no dispositivo:**
- Abra o aplicativo Expo Go no celular e escaneie o QR Code exibido no terminal.
- Alternativamente, pressione a no terminal para rodar no emulador Android ou w para rodar na Web.

---

## 📸 Demonstração do Aplicativo
![Tela do Projeto](/tela_inicial.png)
![Tela do Projeto](/tela_inicial2.png)

---
