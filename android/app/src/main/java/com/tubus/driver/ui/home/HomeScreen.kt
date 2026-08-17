package com.tubus.driver.ui.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.tubus.driver.data.remote.RouteAssignmentDto

@Composable
fun HomeScreen(onLoggedOut: () -> Unit, viewModel: HomeViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsState()
    val queueDepth by viewModel.queueDepth.collectAsState()
    var confirmEndTrip by remember { mutableStateOf(false) }
    var showIncidentSheet by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("TuBus Conductor", style = MaterialTheme.typography.headlineSmall)

        if (state.loading) {
            CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
            return@Column
        }

        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        val trip = state.activeTrip
        if (trip != null) {
            Text("Viaje activo", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
            Text("Cola de sincronización: $queueDepth punto(s) pendiente(s)")
            OutlinedButton(
                onClick = { showIncidentSheet = true },
                modifier = Modifier.padding(top = 16.dp).fillMaxWidth(),
            ) {
                Text("Reportar incidente")
            }
            Button(
                onClick = { confirmEndTrip = true },
                modifier = Modifier.padding(top = 8.dp).fillMaxWidth(),
            ) {
                Text("Finalizar viaje")
            }
        } else {
            Text("Selecciona una ruta", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
            LazyColumn(modifier = Modifier.padding(top = 8.dp)) {
                items(state.routes) { route: RouteAssignmentDto ->
                    val selected = state.selectedRoute?.variantId == route.variantId
                    OutlinedButton(
                        onClick = { viewModel.selectRoute(route) },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        Text("${route.routeName} — ${route.headsign}${if (selected) " ✓" else ""}")
                    }
                }
            }
            Button(
                onClick = viewModel::startTrip,
                enabled = state.selectedRoute != null,
                modifier = Modifier.padding(top = 16.dp).fillMaxWidth(),
            ) {
                Text("Iniciar viaje")
            }
        }

        OutlinedButton(
            onClick = { viewModel.logout(); onLoggedOut() },
            modifier = Modifier.padding(top = 24.dp),
        ) {
            Text("Cerrar sesión")
        }
    }

    LaunchedEffect(state.incidentReported) {
        if (state.incidentReported) {
            showIncidentSheet = false
            viewModel.acknowledgeIncidentReported()
        }
    }

    if (showIncidentSheet) {
        IncidentSheet(
            submitting = state.reportingIncident,
            onDismiss = { showIncidentSheet = false },
            onSubmit = { category, note -> viewModel.reportIncident(category, note) },
        )
    }

    if (confirmEndTrip) {
        AlertDialog(
            onDismissRequest = { confirmEndTrip = false },
            title = { Text("¿Finalizar este viaje?") },
            text = {
                Text(
                    "El viaje se marcará como completado y dejará de aparecer para los " +
                        "pasajeros. Esta acción no se puede deshacer.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmEndTrip = false
                        viewModel.endTrip()
                    },
                ) {
                    Text("Finalizar viaje")
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmEndTrip = false }) {
                    Text("Cancelar")
                }
            },
        )
    }
}
