// src/pages/Personas.jsx

import { useState, useEffect, useRef } from 'react';
import personaService from '../services/personaService';
import authService from '../services/authService';
import useDebounce from '../hooks/useDebounce';
import Alert from '../components/common/Alert';
import Spinner from '../components/common/Spinner';
import { useToast } from '../components/common/Toast.jsx';
import consultaService from '../services/consultaService';

const initialFormData = {
  documento: '',
  nombres: '',
  apellidos: '',
  email: '',
  telefono: '',
  estadoContacto: 'PENDIENTE',
  departamento: '',
  municipio: '',
  zona: '',
  nombrePuesto: '',
  direccion: '',
  mesa: ''
};

function Personas() {
  const { addToast } = useToast();
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  // Usuario actual y rol

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Usuario actual y rol
  const user = authService.getStoredUser();
  const esAdmin = user?.rol === 'ADMIN';
  const esCoordi = user?.rol === 'COORDINADOR';

  // Modal de creación
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [estadoContacto, setEstadoContacto] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [mesa, setMesa] = useState('');

  // Menú de acciones
  const [menuAbierto, setMenuAbierto] = useState(null);

  // Modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [personaEditando, setPersonaEditando] = useState(null);
  const [datosEdicion, setDatosEdicion] = useState({
    nombres: '', apellidos: '', telefono: '', email: '',
    estadoContacto: '', departamento: '', municipio: '',
    zona: '', nombrePuesto: '', direccion: '', mesa: '', notas: ''
  });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Modal "Reclamar y Completar" (para personas sin confirmado)
  const [showReclamarModal, setShowReclamarModal] = useState(false);
  const [personaReclamando, setPersonaReclamando] = useState(null);
  const [datosReclamar, setDatosReclamar] = useState({ nombres: '', apellidos: '', telefono: '', email: '', notas: '' });
  const [reclamando, setReclamando] = useState(false);
  const [reclamarError, setReclamarError] = useState(null);

  // Modal "Reasignar Líder" (COORDINADOR/ADMIN)
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [personaReasignando, setPersonaReasignando] = useState(null);
  const [usuariosLider, setUsuariosLider] = useState([]);
  const [liderSeleccionado, setLiderSeleccionado] = useState('');
  const [reasignando, setReasignando] = useState(false);
  const [reasignarError, setReasignarError] = useState(null);

  // Modal de detalle
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [personaDetalle, setPersonaDetalle] = useState(null);

  // Dropdown cambio rápido de estado
  const [statusDropdownId, setStatusDropdownId] = useState(null);

  // Confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [personaEliminar, setPersonaEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Modal de importación
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Debounce del search
  const debouncedSearch = useDebounce(search, 500);
  const abortControllerRef = useRef(null);
  const menuRef = useRef(null);
  const statusRef = useRef(null);

  useEffect(() => {
    cargarPersonas();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearch, estadoContacto, departamento, mesa, pagination.page]);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuAbierto && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(null);
      }
      if (statusDropdownId && statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuAbierto, statusDropdownId]);

  const cargarPersonas = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);

    const resultado = await personaService.listar({
      page: pagination.page,
      limit: pagination.limit,
      search: debouncedSearch,
      estadoContacto,
      departamento,
      mesa
    }, { signal: controller.signal });

    if (controller.signal.aborted || resultado.canceled) return;

    if (resultado.success) {
      setPersonas(resultado.personas || []);
      setPagination(resultado.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      });
    } else {
      setAlert({ type: 'error', message: resultado.error });
      setPersonas([]);
    }

    setLoading(false);
  };

  const handleExportarCSV = async () => {
    const resultado = await personaService.exportarCSV();
    if (resultado.success) {
      setAlert({ type: 'success', message: 'CSV descargado exitosamente' });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const handleExportarExcel = async () => {
    const resultado = await personaService.exportarExcel();
    if (resultado.success) {
      setAlert({ type: 'success', message: 'Excel descargado exitosamente' });
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  // === Handlers de importación ===
  const handleImportFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setAlert({ type: 'error', message: 'Solo se permiten archivos Excel (.xlsx, .xls)' });
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setAlert({ type: 'error', message: 'El archivo no debe superar los 10MB' });
        return;
      }
      setImportFile(selectedFile);
    }
  };

  const handleImportar = async () => {
    if (!importFile) return;
    setImportando(true);
    setImportResult(null);

    const resultado = await personaService.importarDesdeExcel(importFile);

    if (resultado.success) {
      setImportResult(resultado.data);
      setAlert({ type: 'success', message: `Importado: ${resultado.data.creadas} creadas, ${resultado.data.actualizadas} actualizadas` });
      cargarPersonas();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setImportando(false);
  };

  const handleDescargarPlantillaImportacion = async () => {
    const resultado = await personaService.descargarPlantillaImportacion();
    if (!resultado.success) {
      setAlert({ type: 'error', message: resultado.error });
    }
  };

  const cerrarImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
  };

  const abrirModal = () => {
    setFormData(initialFormData);
    setShowModal(true);
    setAlert(null);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setFormData(initialFormData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCrearPersona = async (e) => {
    e.preventDefault();
    setSaving(true);

    const datosPersona = {
      documento: formData.documento.trim(),
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      email: formData.email.trim() || undefined,
      telefono: formData.telefono.trim() || undefined,
      estadoContacto: formData.estadoContacto,
      puesto: {
        departamento: formData.departamento.trim() || undefined,
        municipio: formData.municipio.trim() || undefined,
        zona: formData.zona.trim() || undefined,
        nombrePuesto: formData.nombrePuesto.trim() || undefined,
        direccion: formData.direccion.trim() || undefined,
        mesa: formData.mesa.trim() || undefined
      }
    };

    Object.keys(datosPersona.puesto).forEach(key => {
      if (!datosPersona.puesto[key]) {
        delete datosPersona.puesto[key];
      }
    });

    if (Object.keys(datosPersona.puesto).length === 0) {
      delete datosPersona.puesto;
    }

    const resultado = await personaService.crear(datosPersona);

    if (resultado.success) {
      setAlert({ type: 'success', message: 'Persona creada exitosamente' });
      cerrarModal();
      cargarPersonas();
    } else {
      setAlert({ type: 'error', message: resultado.error });
    }

    setSaving(false);
  };

  const cambiarPagina = (nuevaPagina) => {
    setPagination({ ...pagination, page: nuevaPagina });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      CONFIRMADO: 'bg-green-100 text-green-800',
      CONTACTADO: 'bg-blue-100 text-blue-800',
      NO_CONTACTADO: 'bg-red-100 text-red-800',
      PENDIENTE: 'bg-yellow-100 text-yellow-800'
    };
    return badges[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoLabel = (estado) => {
    const labels = {
      CONFIRMADO: 'Confirmado',
      CONTACTADO: 'Contactado',
      NO_CONTACTADO: 'No Contactado',
      PENDIENTE: 'Pendiente'
    };
    return labels[estado] || estado || 'Pendiente';
  };

  // === Handlers de gestión ===

  const abrirEditModal = (persona) => {
    setPersonaEditando(persona);
    const p = persona.puesto || {};
    setDatosEdicion({
      nombres: persona.nombres || '',
      apellidos: persona.apellidos || '',
      telefono: persona.telefono || '',
      email: persona.email || '',
      estadoContacto: persona.estadoContacto || 'NO_CONTACTADO',
      departamento: p.departamento || '',
      municipio: p.municipio || '',
      zona: p.zona || '',
      nombrePuesto: p.nombrePuesto || '',
      direccion: p.direccion || '',
      mesa: p.mesa || '',
      notas: persona.notas || ''
    });
    setModalError(null);
    setShowEditModal(true);
    setMenuAbierto(null);
  };

  const handleEdicionChange = (e) => {
    const { name, value } = e.target;
    setDatosEdicion(prev => ({ ...prev, [name]: value }));
  };

  const guardarEdicion = async () => {
    if (!personaEditando?._id) {
      setModalError('No se puede actualizar: falta el ID de la persona');
      return;
    }
    setGuardandoEdicion(true);
    setModalError(null);
    try {
      const datos = {
        nombres: datosEdicion.nombres.trim() || undefined,
        apellidos: datosEdicion.apellidos.trim() || undefined,
        telefono: datosEdicion.telefono.trim() || undefined,
        email: datosEdicion.email.trim() || undefined,
        estadoContacto: datosEdicion.estadoContacto || undefined,
        notas: datosEdicion.notas.trim(),
        puesto: {
          departamento: datosEdicion.departamento.trim() || undefined,
          municipio: datosEdicion.municipio.trim() || undefined,
          zona: datosEdicion.zona.trim() || undefined,
          nombrePuesto: datosEdicion.nombrePuesto.trim() || undefined,
          direccion: datosEdicion.direccion.trim() || undefined,
          mesa: datosEdicion.mesa.trim() || undefined
        }
      };

      Object.keys(datos.puesto).forEach(key => {
        if (!datos.puesto[key]) delete datos.puesto[key];
      });
      if (Object.keys(datos.puesto).length === 0) delete datos.puesto;

      const respuesta = await personaService.actualizar(personaEditando._id, datos);
      if (respuesta.success) {
        addToast({ type: 'success', message: 'Persona actualizada exitosamente' });
        setShowEditModal(false);
        cargarPersonas();
      } else {
        setModalError(respuesta.error || 'Error al actualizar la persona');
      }
    } catch {
      setModalError('Error de conexión al actualizar la persona');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const cambiarEstadoRapido = async (personaId, nuevoEstado) => {
    setStatusDropdownId(null);
    const respuesta = await personaService.actualizar(personaId, { estadoContacto: nuevoEstado });
    if (respuesta.success) {
      setPersonas(prev => prev.map(p =>
        p._id === personaId ? { ...p, estadoContacto: nuevoEstado } : p
      ));
      setAlert({ type: 'success', message: `Estado cambiado a ${getEstadoLabel(nuevoEstado)}` });
    } else {
      setAlert({ type: 'error', message: respuesta.error || 'Error al cambiar estado' });
    }
  };

  const abrirDetalle = (persona) => {
    setPersonaDetalle(persona);
    setShowDetailModal(true);
    setMenuAbierto(null);
  };

  const confirmarEliminar = (persona) => {
    setPersonaEliminar(persona);
    setShowDeleteConfirm(true);
    setMenuAbierto(null);
  };

  const handleEliminar = async () => {
    if (!personaEliminar?._id) return;
    setEliminando(true);
    const respuesta = await personaService.eliminar(personaEliminar._id);
    if (respuesta.success) {
      setAlert({ type: 'success', message: 'Persona eliminada exitosamente' });
      setShowDeleteConfirm(false);
      setPersonaEliminar(null);
      cargarPersonas();
    } else {
      setAlert({ type: 'error', message: respuesta.error || 'Error al eliminar' });
    }
    setEliminando(false);
  };

  // === Handlers: Reclamar y Completar ===

  const abrirReclamarModal = (persona) => {
    setPersonaReclamando(persona);
    setDatosReclamar({ nombres: persona.nombres || '', apellidos: persona.apellidos || '', telefono: persona.telefono || '', email: persona.email || '', notas: persona.notas || '' });
    setReclamarError(null);
    setShowReclamarModal(true);
    setMenuAbierto(null);
  };

  const handleReclamarChange = (e) => {
    const { name, value } = e.target;
    setDatosReclamar(prev => ({ ...prev, [name]: value }));
  };

  const reclamarPersona = async () => {
    if (!personaReclamando?._id) return;
    setReclamando(true);
    setReclamarError(null);
    const respuesta = await consultaService.confirmarPersona(personaReclamando._id, datosReclamar);
    if (respuesta.success) {
      addToast({ type: 'success', message: 'Persona reclamada y completada exitosamente' });
      setShowReclamarModal(false);
      cargarPersonas();
    } else {
      setReclamarError(respuesta.error || 'Error al reclamar la persona');
    }
    setReclamando(false);
  };

  // === Handlers: Reasignar Líder ===

  const abrirReasignarModal = async (persona) => {
    setPersonaReasignando(persona);
    setLiderSeleccionado('');
    setReasignarError(null);
    setShowReasignarModal(true);
    setMenuAbierto(null);
    // Cargar lista de usuarios disponibles para asignar
    const resultado = await personaService.listarUsuariosParaAsignar();
    if (resultado.success) {
      setUsuariosLider(resultado.usuarios.filter(u => u.rol === 'LIDER' || u.rol === 'COORDINADOR'));
    } else {
      setReasignarError(resultado.error || 'No se pudo cargar la lista de usuarios');
    }
  };

  const reasignarLider = async () => {
    if (!personaReasignando?._id || !liderSeleccionado) {
      setReasignarError('Selecciona un líder para asignar');
      return;
    }
    setReasignando(true);
    setReasignarError(null);
    const respuesta = await personaService.asignarLider(personaReasignando._id, liderSeleccionado);
    if (respuesta.success) {
      addToast({ type: 'success', message: 'Líder reasignado exitosamente' });
      setShowReasignarModal(false);
      cargarPersonas();
    } else {
      setReasignarError(respuesta.error || 'Error al reasignar líder');
    }
    setReasignando(false);
  };

  // === Componentes reutilizables inline ===

  const StatusDropdown = ({ personaId, estadoActual }) => (
    <div ref={statusRef} className="absolute z-30 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1" style={{ right: 0 }}>
      {['PENDIENTE', 'NO_CONTACTADO', 'CONTACTADO', 'CONFIRMADO'].map(status => (
        <button
          key={status}
          onClick={(e) => { e.stopPropagation(); cambiarEstadoRapido(personaId, status); }}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${estadoActual === status ? 'font-bold bg-gray-50' : ''}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getEstadoBadge(status).split(' ')[0]}`}></span>
          {getEstadoLabel(status)}
        </button>
      ))}
    </div>
  );

  const ActionMenu = ({ persona }) => (
    <div ref={menuRef} className="absolute z-30 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1" style={{ right: 0 }}>
      {/* Editar solo aparece si la persona está confirmada (tiene lider) */}
      {persona.confirmado && (
        <button
          onClick={() => abrirEditModal(persona)}
          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Editar
        </button>
      )}
      <button
        onClick={() => abrirDetalle(persona)}
        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
        Ver Detalles
      </button>
      {/* Reclamar y Completar: para personas sin líder asignado */}
      {!persona.confirmado && (
        <>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            onClick={() => abrirReclamarModal(persona)}
            className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Reclamar y Completar
          </button>
        </>
      )}
      {/* Reasignar Líder: solo COORDINADOR y ADMIN */}
      {(esAdmin || esCoordi) && (
        <>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            onClick={() => abrirReasignarModal(persona)}
            className="w-full text-left px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            Reasignar Líder
          </button>
        </>
      )}
      {esAdmin && (
        <>
          <div className="border-t border-gray-100 my-1"></div>
          <button
            onClick={() => confirmarEliminar(persona)}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Eliminar
          </button>
        </>
      )}
    </div>
  );

  const ThreeDotsButton = ({ personaId }) => (
    <button
      onClick={(e) => { e.stopPropagation(); setMenuAbierto(menuAbierto === personaId ? null : personaId); setStatusDropdownId(null); }}
      className="text-gray-500 hover:text-primary-600 p-1.5 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-200 transition-all"
      title="Acciones"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
      </svg>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Personas
          </h1>
          <p className="text-gray-600 mt-1">
            Gestiona la base de datos de personas
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
          <button
            onClick={abrirModal}
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:via-teal-600 hover:to-green-700 transition-all font-semibold text-sm shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Nueva Persona
          </button>
          <button
            onClick={handleExportarExcel}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Excel
          </button>
          <button
            onClick={handleExportarCSV}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            CSV
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            Importar
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, documento..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado de Contacto
            </label>
            <select
              value={estadoContacto}
              onChange={(e) => setEstadoContacto(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="CONTACTADO">Contactado</option>
              <option value="NO_CONTACTADO">No Contactado</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departamento
            </label>
            <input
              type="text"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              placeholder="Ej: ATLANTICO"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mesa de Votacion
            </label>
            <input
              type="text"
              value={mesa}
              onChange={(e) => setMesa(e.target.value)}
              placeholder="Ej: 13"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Mostrando {personas.length} de {(pagination.total || 0).toLocaleString()} personas
          </p>
        </div>
      </div>

      {/* Tabla / Cards */}
      {loading ? (
        <Spinner message="Cargando personas..." />
      ) : personas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <span className="text-6xl mb-4 block">🔍</span>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            No se encontraron personas
          </h3>
          <p className="text-gray-600">
            {search || estadoContacto || departamento
              ? 'Intenta ajustar los filtros de busqueda'
              : 'Aun no hay personas registradas en la base de datos'}
          </p>
        </div>
      ) : (
        <>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Telefono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Puesto / Mesa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      RPA
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lider
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {personas.map((persona) => (
                    <tr key={persona._id || persona.documento} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {persona.documento || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {persona.nombres || 'Sin nombre'} {persona.apellidos || ''}
                          </div>
                          {persona.email && (
                            <div className="text-sm text-gray-500">{persona.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {persona.telefono || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {persona.puesto?.nombrePuesto || 'Sin puesto'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {persona.puesto?.municipio || ''} {persona.puesto?.mesa ? `- Mesa ${persona.puesto.mesa}` : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === persona._id ? null : persona._id); setMenuAbierto(null); }}
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity ${getEstadoBadge(persona.estadoContacto)}`}
                        >
                          {getEstadoLabel(persona.estadoContacto)}
                        </button>
                        {statusDropdownId === persona._id && (
                          <StatusDropdown personaId={persona._id} estadoActual={persona.estadoContacto} />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const rpa = persona.estadoRPA;
                          const cfg = {
                            ACTUALIZADO: { label: 'Actualizado', cls: 'bg-green-100 text-green-700' },
                            ERROR_CONSULTA: { label: 'Error', cls: 'bg-red-100 text-red-700' },
                            CONSULTANDO: { label: 'Consultando', cls: 'bg-blue-100 text-blue-700' },
                            PENDIENTE_CONSULTA: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
                            PENDIENTE_ACTUALIZACION: { label: 'Pend. Act.', cls: 'bg-orange-100 text-orange-700' },
                            NUEVO: { label: 'Sin consultar', cls: 'bg-gray-100 text-gray-600' }
                          };
                          const { label, cls } = cfg[rpa] || cfg.NUEVO;
                          return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {persona.lider?.nombre || persona.lider?.perfil?.nombres || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <ThreeDotsButton personaId={persona._id} />
                        {menuAbierto === persona._id && (
                          <ActionMenu persona={persona} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Mobile - Cards */}
          <div className="lg:hidden space-y-4">
            {personas.map((persona) => (
              <div key={persona._id || persona.documento} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header de la card */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <h3 className="font-bold text-gray-900 truncate">
                        {persona.nombres || 'Sin nombre'} {persona.apellidos || ''}
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">CC {persona.documento || 'N/A'}</p>
                    </div>
                    {/* Status badges */}
                    <div className="relative flex-shrink-0 flex flex-col items-end gap-1">
                      <button
                        onClick={() => { setStatusDropdownId(statusDropdownId === persona._id ? null : persona._id); setMenuAbierto(null); }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-opacity hover:opacity-80 ${getEstadoBadge(persona.estadoContacto)}`}
                      >
                        {getEstadoLabel(persona.estadoContacto)}
                      </button>
                      {statusDropdownId === persona._id && (
                        <StatusDropdown personaId={persona._id} estadoActual={persona.estadoContacto} />
                      )}
                      {(() => {
                        const rpa = persona.estadoRPA;
                        const cfg = {
                          ACTUALIZADO: { label: 'RPA OK', cls: 'bg-green-100 text-green-700' },
                          ERROR_CONSULTA: { label: 'RPA Error', cls: 'bg-red-100 text-red-700' },
                          CONSULTANDO: { label: 'Consultando', cls: 'bg-blue-100 text-blue-700' },
                          PENDIENTE_CONSULTA: { label: 'RPA Pend.', cls: 'bg-yellow-100 text-yellow-700' },
                          PENDIENTE_ACTUALIZACION: { label: 'Pend. Act.', cls: 'bg-orange-100 text-orange-700' },
                          NUEVO: null
                        };
                        const c = cfg[rpa];
                        return c ? <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.cls}`}>{c.label}</span> : null;
                      })()}
                    </div>
                  </div>

                  {/* Info de la persona */}
                  <div className="space-y-1.5 text-sm">
                    {persona.telefono && (
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {persona.telefono}
                      </div>
                    )}
                    {persona.email && (
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <span className="truncate">{persona.email}</span>
                      </div>
                    )}
                    {persona.puesto?.nombrePuesto && (
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {persona.puesto.nombrePuesto}
                        {persona.puesto?.mesa ? <span className="ml-1 text-gray-400">| Mesa {persona.puesto.mesa}</span> : ''}
                      </div>
                    )}
                    {persona.puesto?.municipio && (
                      <div className="flex items-center text-gray-600">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {persona.puesto.municipio}{persona.puesto?.departamento ? `, ${persona.puesto.departamento}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de acciones */}
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                  <button
                    onClick={() => abrirEditModal(persona)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Editar
                  </button>
                  <button
                    onClick={() => abrirDetalle(persona)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Detalle
                  </button>
                  {esAdmin && (
                    <button
                      onClick={() => confirmarEliminar(persona)}
                      className="inline-flex items-center justify-center p-2 text-red-500 bg-white rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors border border-gray-200"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginacion */}
          {pagination.pages > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => cambiarPagina(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Pagina {pagination.page} de {pagination.pages}
                  </span>
                </div>

                <button
                  onClick={() => cambiarPagina(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Crear Persona */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Nueva Persona
              </h2>
              <button
                onClick={cerrarModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCrearPersona} className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                  Datos Personales
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Documento (Cedula) *</label>
                    <input type="text" name="documento" value={formData.documento} onChange={handleInputChange} required maxLength="15" placeholder="Ej: 1234567890" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombres *</label>
                    <input type="text" name="nombres" value={formData.nombres} onChange={handleInputChange} required placeholder="Ej: Juan Carlos" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos *</label>
                    <input type="text" name="apellidos" value={formData.apellidos} onChange={handleInputChange} required placeholder="Ej: Perez Garcia" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Ej: correo@ejemplo.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                    <input type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} placeholder="Ej: 3001234567" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado de Contacto</label>
                    <select name="estadoContacto" value={formData.estadoContacto} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="CONTACTADO">Contactado</option>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="NO_CONTACTADO">No Contactado</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
                  Puesto de Votacion
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <input type="text" name="departamento" value={formData.departamento} onChange={handleInputChange} placeholder="Ej: ATLANTICO" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
                    <input type="text" name="municipio" value={formData.municipio} onChange={handleInputChange} placeholder="Ej: BARRANQUILLA" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                    <input type="text" name="zona" value={formData.zona} onChange={handleInputChange} placeholder="Ej: URBANA" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Puesto</label>
                    <input type="text" name="nombrePuesto" value={formData.nombrePuesto} onChange={handleInputChange} placeholder="Ej: IE MARIA EMMA" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                    <input type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} placeholder="Ej: CRA 12 No 6-61" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mesa</label>
                    <input type="text" name="mesa" value={formData.mesa} onChange={handleInputChange} placeholder="Ej: 13" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <button type="button" onClick={cerrarModal} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium">
                  {saving ? 'Guardando...' : 'Crear Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Persona */}
      {showEditModal && personaEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header azul */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Editar Persona</h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {personaEditando.nombres} {personaEditando.apellidos} - CC {personaEditando.documento}
                  </p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Datos Personales */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Datos Personales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                    <input type="text" name="nombres" value={datosEdicion.nombres} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                    <input type="text" name="apellidos" value={datosEdicion.apellidos} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
              </div>

              {/* Datos de Contacto */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Datos de Contacto</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                    <input type="tel" name="telefono" value={datosEdicion.telefono} onChange={handleEdicionChange} placeholder="3001234567" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" name="email" value={datosEdicion.email} onChange={handleEdicionChange} placeholder="correo@ejemplo.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado de Contacto</label>
                    <select name="estadoContacto" value={datosEdicion.estadoContacto} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="NO_CONTACTADO">No Contactado</option>
                      <option value="CONTACTADO">Contactado</option>
                      <option value="CONFIRMADO">Confirmado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Puesto de Votacion */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Puesto de Votacion</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <input type="text" name="departamento" value={datosEdicion.departamento} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Municipio</label>
                    <input type="text" name="municipio" value={datosEdicion.municipio} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                    <input type="text" name="zona" value={datosEdicion.zona} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Puesto</label>
                    <input type="text" name="nombrePuesto" value={datosEdicion.nombrePuesto} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                    <input type="text" name="direccion" value={datosEdicion.direccion} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mesa</label>
                    <input type="text" name="mesa" value={datosEdicion.mesa} onChange={handleEdicionChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Notas</h4>
                <textarea
                  name="notas"
                  value={datosEdicion.notas}
                  onChange={handleEdicionChange}
                  rows={3}
                  placeholder="Notas adicionales sobre esta persona..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Error dentro del modal */}
            {modalError && (
              <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{modalError}</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl flex space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                disabled={guardandoEdicion}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center justify-center"
              >
                {guardandoEdicion ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Guardando...
                  </>
                ) : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Persona */}
      {showDetailModal && personaDetalle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header verde */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Detalle de Persona</h3>
                  <p className="text-green-100 text-sm mt-1">
                    {personaDetalle.nombres} {personaDetalle.apellidos} - CC {personaDetalle.documento}
                  </p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Datos Personales */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Datos Personales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Documento:</span> <span className="font-medium ml-1">{personaDetalle.documento}</span></div>
                  <div><span className="text-gray-500">Nombres:</span> <span className="font-medium ml-1">{personaDetalle.nombres || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Apellidos:</span> <span className="font-medium ml-1">{personaDetalle.apellidos || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Telefono:</span> <span className="font-medium ml-1">{personaDetalle.telefono || 'N/A'}</span></div>
                  <div className="sm:col-span-2"><span className="text-gray-500">Email:</span> <span className="font-medium ml-1">{personaDetalle.email || 'N/A'}</span></div>
                </div>
              </div>

              {/* Puesto de Votacion */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Puesto de Votacion</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Departamento:</span> <span className="font-medium ml-1">{personaDetalle.puesto?.departamento || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Municipio:</span> <span className="font-medium ml-1">{personaDetalle.puesto?.municipio || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Zona:</span> <span className="font-medium ml-1">{personaDetalle.puesto?.zona || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Puesto:</span> <span className="font-medium ml-1">{personaDetalle.puesto?.nombrePuesto || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Direccion:</span> <span className="font-medium ml-1">{personaDetalle.puesto?.direccion || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Mesa:</span> <span className="font-medium ml-1">{personaDetalle.puesto?.mesa || 'N/A'}</span></div>
                </div>
              </div>

              {/* Lider Asignado */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Lider Asignado</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Nombre:</span> <span className="font-medium ml-1">{personaDetalle.lider?.nombre || personaDetalle.lider?.perfil?.nombres || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium ml-1">{personaDetalle.lider?.email || 'N/A'}</span></div>
                </div>
              </div>

              {/* Estado */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Estado</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-1">Estado Contacto:</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getEstadoBadge(personaDetalle.estadoContacto)}`}>
                      {getEstadoLabel(personaDetalle.estadoContacto)}
                    </span>
                  </div>
                  <div><span className="text-gray-500">Estado RPA:</span> <span className="font-medium ml-1">{personaDetalle.estadoRPA || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Origen:</span> <span className="font-medium ml-1">{personaDetalle.origen || 'N/A'}</span></div>
                  <div><span className="text-gray-500">Confirmado:</span> <span className="font-medium ml-1">{personaDetalle.confirmado ? 'Si' : 'No'}</span></div>
                </div>
              </div>

              {/* Notas */}
              {personaDetalle.notas && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Notas</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">{personaDetalle.notas}</p>
                </div>
              )}

              {/* Fechas */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">Fechas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Creado:</span> <span className="font-medium ml-1">{personaDetalle.createdAt ? new Date(personaDetalle.createdAt).toLocaleString('es-CO') : 'N/A'}</span></div>
                  <div><span className="text-gray-500">Actualizado:</span> <span className="font-medium ml-1">{personaDetalle.updatedAt ? new Date(personaDetalle.updatedAt).toLocaleString('es-CO') : 'N/A'}</span></div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => { abrirEditModal(personaDetalle); setShowDetailModal(false); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar Personas */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Importar Personas desde Excel</h3>
                  <p className="text-purple-100 text-sm mt-1">Carga un archivo con datos completos</p>
                </div>
                <button onClick={cerrarImportModal} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Descargar plantilla */}
              <button
                onClick={handleDescargarPlantillaImportacion}
                className="w-full text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 hover:bg-purple-100 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar Plantilla Excel
              </button>

              {/* Upload area */}
              <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                importFile ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-purple-400'
              }`}>
                <input type="file" id="import-file" accept=".xlsx,.xls" onChange={handleImportFileChange} className="hidden" />
                {importFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-purple-800">{importFile.name}</p>
                    <p className="text-sm text-purple-600">{(importFile.size / 1024).toFixed(1)} KB</p>
                    <button onClick={() => setImportFile(null)} className="text-sm text-red-600 hover:text-red-800 underline">Quitar</button>
                  </div>
                ) : (
                  <label htmlFor="import-file" className="cursor-pointer block">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-2">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <span className="font-medium text-purple-600">Click para seleccionar</span>
                    <span className="text-gray-500"> o arrastra</span>
                    <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) - Columnas: Cedula, Nombres, Apellidos, Telefono, Email, Depto, Municipio, Puesto, Direccion, Mesa, Estado</p>
                  </label>
                )}
              </div>

              {/* Botón importar */}
              <button
                onClick={handleImportar}
                disabled={!importFile || importando}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  importFile && !importando
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {importando ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importando...
                  </>
                ) : 'Importar Personas'}
              </button>

              {/* Resultados de importación */}
              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-green-900 text-sm">Resultado de Importacion</h4>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-lg font-bold text-gray-900">{importResult.total}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-green-500">
                      <p className="text-xs text-green-600">Creadas</p>
                      <p className="text-lg font-bold text-green-700">{importResult.creadas}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-blue-500">
                      <p className="text-xs text-blue-600">Actualizadas</p>
                      <p className="text-lg font-bold text-blue-700">{importResult.actualizadas}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border-l-4 border-red-500">
                      <p className="text-xs text-red-600">Errores</p>
                      <p className="text-lg font-bold text-red-700">{importResult.errores}</p>
                    </div>
                  </div>
                  {importResult.detallesErrores?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-red-800 mb-1">Errores:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResult.detallesErrores.map((err, i) => (
                          <div key={i} className="text-xs bg-white rounded px-2 py-1 flex justify-between border border-red-100">
                            <span className="font-mono">{err.cedula} (fila {err.fila})</span>
                            <span className="text-red-600 ml-2">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminacion */}
      {showDeleteConfirm && personaEliminar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-fade-in">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Eliminacion</h3>
              <p className="text-gray-600 mb-1">
                Estas seguro de eliminar a:
              </p>
              <p className="font-semibold text-gray-900 mb-4">
                {personaEliminar.nombres} {personaEliminar.apellidos} ({personaEliminar.documento})
              </p>
              <p className="text-sm text-red-600 mb-6">
                Esta accion no se puede deshacer.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setPersonaEliminar(null); }}
                disabled={eliminando}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 transition-colors"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reclamar y Completar */}
      {showReclamarModal && personaReclamando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Reclamar y Completar</h3>
                  <p className="text-green-100 text-sm mt-1">CC: {personaReclamando.documento}</p>
                </div>
                <button onClick={() => setShowReclamarModal(false)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombres <span className="text-red-500">*</span></label>
                  <input type="text" name="nombres" value={datosReclamar.nombres} onChange={handleReclamarChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Nombres completos" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos <span className="text-red-500">*</span></label>
                  <input type="text" name="apellidos" value={datosReclamar.apellidos} onChange={handleReclamarChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Apellidos completos" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" name="telefono" value={datosReclamar.telefono} onChange={handleReclamarChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="3001234567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={datosReclamar.email} onChange={handleReclamarChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="correo@ejemplo.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea name="notas" value={datosReclamar.notas} onChange={handleReclamarChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none" placeholder="Notas adicionales..." />
              </div>
              {reclamarError && (
                <div className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-red-700">{reclamarError}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl flex space-x-3">
              <button onClick={() => setShowReclamarModal(false)} className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
              <button
                onClick={reclamarPersona}
                disabled={reclamando || !datosReclamar.nombres.trim() || !datosReclamar.apellidos.trim()}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors flex items-center justify-center"
              >
                {reclamando ? (
                  <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Reclamando...</>
                ) : 'Reclamar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reasignar Líder */}
      {showReasignarModal && personaReasignando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Reasignar Líder</h3>
                  <p className="text-blue-100 text-sm mt-1">{personaReasignando.nombres || 'Sin nombre'} {personaReasignando.apellidos || ''} — CC {personaReasignando.documento}</p>
                </div>
                <button onClick={() => setShowReasignarModal(false)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {personaReasignando.lider?.nombre && (
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  <span className="font-medium">Líder actual:</span> {personaReasignando.lider.nombre} ({personaReasignando.lider.email})
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Líder <span className="text-red-500">*</span></label>
                {usuariosLider.length === 0 ? (
                  <p className="text-sm text-gray-500">Cargando usuarios...</p>
                ) : (
                  <select
                    value={liderSeleccionado}
                    onChange={(e) => setLiderSeleccionado(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Selecciona un líder --</option>
                    {usuariosLider.map(u => (
                      <option key={u._id} value={u._id}>
                        {u.perfil?.nombres} {u.perfil?.apellidos} ({u.email}) — {u.rol}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {reasignarError && (
                <div className="px-4 py-3 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-red-700">{reasignarError}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl flex space-x-3">
              <button onClick={() => setShowReasignarModal(false)} className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
              <button
                onClick={reasignarLider}
                disabled={reasignando || !liderSeleccionado}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center justify-center"
              >
                {reasignando ? (
                  <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Reasignando...</>
                ) : 'Confirmar Reasignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Personas;
