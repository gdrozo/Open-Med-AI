use axum::http::{header, StatusCode};
use axum::routing::delete;
use axum::{
    extract::{Query, State, DefaultBodyLimit, Path as AxumPath},
    body::Bytes,
    response::{IntoResponse, sse::{Event, KeepAlive, Sse}},
    routing::{get, post, patch},
    Router,
};
use futures_util::stream::{self, Stream};
use std::convert::Infallible;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tower_http::cors::{Any, CorsLayer};

use std::fs;
use std::path::{Path};
use uuid::Uuid;
use tauri::Manager;
use sqlx::{SqlitePool};
use serde::{Serialize, Deserialize};


#[derive(Clone)]
struct AppState {
    handle: tauri::AppHandle,
    db: SqlitePool,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Chat {
    id: i64,
    title: String,
    image_path: Option<String>,
    created_at: String,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Message {
    id: i64,
    chat_id: i64,
    role: String,
    content: String,
    folder: Option<String>,
    created_at: String,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Workflow {
    id: i64,
    name: String,
    required_context: String,
    created_at: String,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct WorkflowStep {
    id: i64,
    workflow_id: i64,
    prompt: String,
    step_order: i32,
}

#[derive(Deserialize)]
struct CreateChatRequest {
    title: String,
    image_path: String,
}

#[derive(Deserialize)]
struct CreateWorkflowRequest {
    name: String,
    required_context: String,
}

#[derive(Deserialize)]
struct WorkflowStepRequest {
    prompt: String,
    step_order: i32,
}

#[derive(Deserialize)]
struct UpdateStepsRequest {
    steps: Vec<WorkflowStepRequest>,
}

#[derive(Deserialize)]
struct SaveMessageRequest {
    role: String,
    content: String,
    folder: Option<String>,
}

#[derive(Deserialize)]
struct UpdateMessageRequest {
    content: String,
}

#[derive(Deserialize)]
struct UpdateTitleRequest {
    title: String,
}

#[derive(Deserialize)]
struct UpdateImageRequest {
    image_path: String,
}

#[tauri::command]
fn get_rust_server_port() -> u16 {
    8001
}

async fn start_python_stream() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    println!("Starting Python server and streaming output...");

    // Determine the python executable (prefer venv if it exists)
    let python_path = "../python/venv/Scripts/python.exe";
    let python_exe = if Path::new(python_path).exists() {
        python_path.to_string()
    } else {
        // cant continue without python
        panic!("Python executable not found");
    };

    let script_path = "../python/ai_server.py";

    let mut child = Command::new(python_exe)
        .arg(script_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn python server");

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let stdout_reader = BufReader::new(stdout).lines();
    let stderr_reader = BufReader::new(stderr).lines();

    let stdout_stream = stream::unfold(stdout_reader, |mut reader| async {
        match reader.next_line().await {
            Ok(Some(line)) => Some((Ok::<Event, Infallible>(Event::default().data(line)), reader)),
            _ => None,
        }
    });

    let stderr_stream = stream::unfold(stderr_reader, |mut reader| async {
        match reader.next_line().await {
            Ok(Some(line)) => Some((
                Ok::<Event, Infallible>(Event::default().data(format!("[ERROR] {}", line))),
                reader,
            )),
            _ => None,
        }
    });

    let combined_stream = futures_util::stream::select(stdout_stream, stderr_stream);

    Sse::new(combined_stream).keep_alive(KeepAlive::default())
}

const CHAT_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
";

const MESSAGE_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      role TEXT,
      content TEXT,
      folder TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
    )
";

const WORKFLOW_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      required_context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
";

const WORKFLOW_STEP_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER,
      prompt TEXT,
      step_order INTEGER,
      FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
    )
";

async fn store_blob_image(
    State(state): State<AppState>, 
    image_bytes: Bytes
) -> impl IntoResponse {

    println!("Received image of size {}", image_bytes.len());

    let mut upload_path = match state.handle.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    upload_path.push("user_images");

    if !upload_path.exists() {
        if let Err(e) = fs::create_dir_all(&upload_path) {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }

    let file_id = Uuid::new_v4().to_string();
    let file_name = format!("{}.png", file_id);
    let full_file_path = upload_path.join(&file_name);

    if let Err(e) = fs::write(&full_file_path, image_bytes) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }
    
    let path_str = full_file_path.to_string_lossy().into_owned();
    (StatusCode::OK, path_str).into_response()
}


#[derive(Deserialize)]
struct AssetQuery {
    path: String,
}

async fn serve_asset(Query(params): Query<AssetQuery>) -> impl IntoResponse {
    let path_str = params.path;
    let path = Path::new(&path_str);

    println!("Serving asset: {}", path_str);

    if !path.exists() {
        return (StatusCode::NOT_FOUND, "File not found").into_response();
    }

    match tokio::fs::read(path).await {
        Ok(contents) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                [(header::CONTENT_TYPE, mime.as_ref())],
                contents,
            ).into_response()
        }
        Err(e) => {
            eprintln!("Error reading file {}: {}", path_str, e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read file").into_response()
        }
    }
}

async fn get_chats(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_as::<_, Chat>("SELECT * FROM chats ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
    {
        Ok(chats) => (StatusCode::OK, axum::Json(chats)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_chat(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<i64>
) -> impl IntoResponse {
    match sqlx::query_as::<_, Chat>("SELECT * FROM chats WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
    {
        Ok(chat) => (StatusCode::OK, axum::Json(chat)).into_response(),
        Err(e) => (StatusCode::NOT_FOUND, e.to_string()).into_response(),
    }
}

async fn create_chat(
    State(state): State<AppState>,
    axum::Json(payload): axum::Json<CreateChatRequest>
) -> impl IntoResponse {
    match sqlx::query("INSERT INTO chats (title, image_path) VALUES (?, ?)")
        .bind(payload.title)
        .bind(payload.image_path)
        .execute(&state.db)
        .await
    {
        Ok(result) => (StatusCode::CREATED, axum::Json(result.last_insert_rowid())).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn delete_chat(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<i64>
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM chats WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_messages(
    State(state): State<AppState>,
    AxumPath(chat_id): AxumPath<i64>
) -> impl IntoResponse {
    match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC")
        .bind(chat_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(messages) => (StatusCode::OK, axum::Json(messages)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn save_message(
    State(state): State<AppState>,
    AxumPath(chat_id): AxumPath<i64>,
    axum::Json(payload): axum::Json<SaveMessageRequest>
) -> impl IntoResponse {
    let folder = payload.folder.unwrap_or_default();
    match sqlx::query("INSERT INTO messages (chat_id, role, content, folder) VALUES (?, ?, ?, ?)")
        .bind(chat_id)
        .bind(payload.role)
        .bind(payload.content)
        .bind(folder)
        .execute(&state.db)
        .await
    {
        Ok(result) => (StatusCode::CREATED, axum::Json(result.last_insert_rowid())).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn update_message(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<i64>,
    axum::Json(payload): axum::Json<UpdateMessageRequest>
) -> impl IntoResponse {
    match sqlx::query("UPDATE messages SET content = ? WHERE id = ?")
        .bind(payload.content)
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn update_chat_title(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<i64>,
    axum::Json(payload): axum::Json<UpdateTitleRequest>
) -> impl IntoResponse {
    match sqlx::query("UPDATE chats SET title = ? WHERE id = ?")
        .bind(payload.title)
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn update_chat_image(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<i64>,
    axum::Json(payload): axum::Json<UpdateImageRequest>
) -> impl IntoResponse {
    match sqlx::query("UPDATE chats SET image_path = ? WHERE id = ?")
        .bind(payload.image_path)
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => StatusCode::OK.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

// Workflow Handlers
async fn get_workflows(State(state): State<AppState>) -> impl IntoResponse {
    match sqlx::query_as::<_, Workflow>("SELECT * FROM workflows ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
    {
        Ok(workflows) => (StatusCode::OK, axum::Json(workflows)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn create_workflow(
    State(state): State<AppState>,
    axum::Json(payload): axum::Json<CreateWorkflowRequest>
) -> impl IntoResponse {
    match sqlx::query("INSERT INTO workflows (name, required_context) VALUES (?, ?)")
        .bind(payload.name)
        .bind(payload.required_context)
        .execute(&state.db)
        .await
    {
        Ok(result) => (StatusCode::CREATED, axum::Json(result.last_insert_rowid())).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn delete_workflow(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<i64>
) -> impl IntoResponse {
    match sqlx::query("DELETE FROM workflows WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn get_workflow_steps(
    State(state): State<AppState>,
    AxumPath(workflow_id): AxumPath<i64>
) -> impl IntoResponse {
    match sqlx::query_as::<_, WorkflowStep>("SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC")
        .bind(workflow_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(steps) => (StatusCode::OK, axum::Json(steps)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn update_workflow_steps(
    State(state): State<AppState>,
    AxumPath(workflow_id): AxumPath<i64>,
    axum::Json(payload): axum::Json<UpdateStepsRequest>
) -> impl IntoResponse {
    // Basic batch update: delete existing steps and insert new ones
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    if let Err(e) = sqlx::query("DELETE FROM workflow_steps WHERE workflow_id = ?")
        .bind(workflow_id)
        .execute(&mut *tx)
        .await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    for step in payload.steps {
        if let Err(e) = sqlx::query("INSERT INTO workflow_steps (workflow_id, prompt, step_order) VALUES (?, ?, ?)")
            .bind(workflow_id)
            .bind(step.prompt)
            .bind(step.step_order)
            .execute(&mut *tx)
            .await {
            return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }

    if let Err(e) = tx.commit().await {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }

    StatusCode::OK.into_response()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Start the Axum server in a separate thread
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    // Initialize DB
                    let mut db_path = handle.path().app_data_dir().unwrap();
                    if !db_path.exists() {
                        fs::create_dir_all(&db_path).unwrap();
                    }
                    db_path.push("chats.db");
                    let db_url = format!("sqlite:{}", db_path.to_string_lossy());
                    
                    // Create file if not exists for sqlx
                    if !db_path.exists() {
                        fs::File::create(&db_path).unwrap();
                    }

                    let db = SqlitePool::connect(&db_url).await.unwrap();

                    // Create tables if not exist
                    sqlx::query(CHAT_SCHEMA).execute(&db).await.unwrap();
                    sqlx::query(MESSAGE_SCHEMA).execute(&db).await.unwrap();
                    sqlx::query(WORKFLOW_SCHEMA).execute(&db).await.unwrap();
                    sqlx::query(WORKFLOW_STEP_SCHEMA).execute(&db).await.unwrap();

                    let state = AppState { handle, db };

                    let cors = CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any);

                    let app = Router::new()
                        .route("/start", get(start_python_stream))
                        .route("/asset", get(serve_asset))
                        .route("/store-blob-image", post(store_blob_image))
                        .route("/db/chats", get(get_chats).post(create_chat))
                        .route("/db/chats/{id}", get(get_chat).delete(delete_chat))
                        .route("/db/chats/{id}/messages", get(get_messages).post(save_message))
                        .route("/db/chats/{id}/title", patch(update_chat_title))
                        .route("/db/chats/{id}/image", patch(update_chat_image))
                        .route("/db/messages/{id}", patch(update_message))
                        .route("/db/workflows", get(get_workflows).post(create_workflow))
                        .route("/db/workflows/{id}", delete(delete_workflow))
                        .route("/db/workflows/{id}/steps", get(get_workflow_steps).post(update_workflow_steps))
                        .layer(DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB
                        .with_state(state)
                        .layer(cors);

                    let listener = tokio::net::TcpListener::bind("127.0.0.1:8001")
                        .await
                        .unwrap();
                    println!("Rust streaming server listening on http://127.0.0.1:8001");
                    axum::serve(listener, app).await.unwrap();
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_rust_server_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}