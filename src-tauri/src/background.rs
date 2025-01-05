use futures::StreamExt;
use arti::socks;
use arti_client::{TorClient, TorClientConfig};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::Response;

#[cfg(target_os = "android")]
use jni::{
    objects::{JClass, JObject, JString},
    sys::jint,
    JNIEnv,
};

#[cfg(target_os = "android")]
use ndk::looper::ThreadLooper;
#[cfg(target_os = "android")]
use ndk_glue::native_activity;

use std::sync::Arc;
use tauri::Manager;

use serde::Deserialize;
use tokio::select;
use tokio::task;
use tokio_util::sync::CancellationToken;
use tor_cell::relaycell::msg::Connected;
use tor_config::Listen;
use tor_hsservice::config::OnionServiceConfigBuilder;
use tor_hsservice::StreamRequest;
use tor_proto::stream::IncomingStreamRequest;
use tor_rtcompat::PreferredRuntime;
use std::path::PathBuf;
use uuid::Uuid;
use hyper::Method;
use rusqlite::Connection;
use std::error::Error;

use anyhow::Result;
use hyper::body::Incoming;
use hyper::Request;
use hyper_util::rt::{TokioExecutor, TokioIo};
use hyper_util::server;
use tower::Service;
use axum::{
    body::Body,
    extract::{State, Json},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};

use std::env;
use arti_client::config::CfgPathResolver;
use std::borrow::Cow;

use crate::get_or_create_profile;
use crate::write_tor_addr_to_file;

struct WebHandler {
    shutdown: CancellationToken,
}
#[derive(Debug, Deserialize)]
struct IncomingMessage {
    content: String,
    from: String,
}

struct AppState {
    config_path: Option<PathBuf>,
    onion_addr: String,
}


async fn root_handler() -> impl IntoResponse {
    (StatusCode::OK, "Hello, World!")
}

//#[axum::debug_handler]
async fn message_handler(
    State(state): State<Arc<AppState>>,
    Json(message): Json<IncomingMessage>,
) -> impl IntoResponse {
    let db_path = format!(
        "{}/letscage.db",
        state.config_path.as_ref().unwrap().to_str().unwrap()
    );

    let conn = match Connection::open(&db_path) {
        Ok(conn) => conn,
        Err(e) => {
            log::error!("Failed to open database: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error");
        }
    };

    let msg_id = Uuid::new_v4().to_string();

    match conn.execute(
        "INSERT INTO messages (message_id, from_user, to_user, content, timestamp, unread)
         VALUES (?1, ?2, ?3, ?4, datetime('now'), 1)",
        [
            &msg_id,
            &message.from,
            state.onion_addr.as_str(),
            &message.content,
        ],
    ) {
        Ok(_) => (StatusCode::OK, "Message received"),
        Err(e) => {
            log::error!("Failed to insert message: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        }
    }
}

// Then you can set up your router like so:
fn build_app(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/", get(root_handler))
        .route("/message", post(message_handler))
        .with_state(state)
}

async fn handle_stream_request(stream_request: StreamRequest, router: Router, onion_addr: String,
    config_path: Option<PathBuf>) -> Result<()> {
    match stream_request.request() {
        IncomingStreamRequest::Begin(begin) if begin.port() == 80 => {
            let onion_service_stream = stream_request.accept(Connected::new_empty()).await?;
            let io = TokioIo::new(onion_service_stream);

            let hyper_service = hyper::service::service_fn(move |request: Request<Incoming>| {
                router.clone().call(request)
            });

            server::conn::auto::Builder::new(TokioExecutor::new())
                .serve_connection(io, hyper_service)
                .await
                .map_err(|x| anyhow::anyhow!(x))?;
        }
        _ => {
            stream_request.shutdown_circuit()?;
        }
    }

    Ok(())
}


#[cfg(target_os = "android")]
pub fn set_home_properly() {
    /*Set HOME */
    const APP_BASE_DIR: &str = "/data/user/0/com.letscage_mobile.app";
    let APP_USER_HOME = format!("{}/{}", APP_BASE_DIR, "home");
    env::set_var("HOME", APP_USER_HOME.as_str());
    let mut path_resolver = CfgPathResolver::default();
    let app_user_home_path = PathBuf::from(APP_USER_HOME);
    path_resolver.set_var("USER_HOME", Ok(Cow::Owned(app_user_home_path)));
}


pub async fn arti_start(config_path: Option<PathBuf>) -> Result<()> {
    #[cfg(target_os = "android")]
    android_logger::init_once(
        android_logger::Config::default()
            //.with_max_level(LevelFilter::Trace)
            .with_tag("{{app.name}}"),
    );

    #[cfg(target_os = "android")]
    set_home_properly();

    // Setup handler with cancellation
    let handler = Arc::new(WebHandler {
        shutdown: CancellationToken::new(),
    });
    let shutdown = handler.shutdown.clone();

    // Setup Tor client
    let config = TorClientConfig::default();
    let client = TorClient::create_bootstrapped(config).await?;

    // Setup SOCKS proxy
    let socks_listen = Listen::new_localhost(9050);
    let runtime = PreferredRuntime::current()?;

    let socks_task = {
        let runtime = runtime.clone();
        let client = client.clone();
        task::spawn(async move {
            if let Err(e) = socks::run_socks_proxy::<PreferredRuntime>(
                runtime,
                client,
                socks_listen,
                #[cfg(feature = "rpc")]
                rpc_data,
            )
            .await
            {
                log::info!("Socks proxy error: {}", e);
            }
        })
    };

    // Setup onion service
    let client = Arc::new(client);
    let generated_nickname = get_or_create_profile(config_path.clone()).nickname;
    let svc_cfg: tor_hsservice::OnionServiceConfig = OnionServiceConfigBuilder::default()
        .nickname(generated_nickname.parse()?)
        .build()?;

    let (service, request_stream) = client.launch_onion_service(svc_cfg)?;
    let mut onion_addr = String::from("");
    if let Some(onion) = service.onion_name() {
        log::info!("Onion address: {}", onion);
        onion_addr = format!("{}", onion);
    }

    write_tor_addr_to_file(config_path.clone(), onion_addr.clone());

    //let shutdown = CancellationToken::new();
    // Axum router
    let state = Arc::new(AppState {
        config_path: config_path.clone(),
        onion_addr: onion_addr.clone()
    });

    let router = build_app(state.clone());


    let onion_task = task::spawn(async move {
        let mut requests = tor_hsservice::handle_rend_requests(request_stream);
        while let Some(stream_request) = requests.next().await {
            let onion_clone = onion_addr.clone();
            let pbuff = config_path.clone();
            let router_clone = router.clone();
            tokio::spawn(async move {
                if let Err(err) = handle_stream_request(stream_request, router_clone, onion_clone, pbuff).await
                {
                    log::info!("Error serving request: {}", err);
                }
            });
        }
        drop(service);
    });

    // Run both tasks until shutdown
    select! {
        _ = socks_task => Ok::<(), anyhow::Error>(log::info!("SOCKS task completed")),
        _ = onion_task => Ok::<(), anyhow::Error>(log::info!("Onion task completed")),
        _ = shutdown.cancelled() => Ok::<(), anyhow::Error>(log::info!("Shutdown requested")),
    }
}
