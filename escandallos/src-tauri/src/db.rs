use sqlx::mysql::MySqlPool;
use std::sync::OnceLock;

static DB_POOL: OnceLock<MySqlPool> = OnceLock::new();

pub async fn init_db() -> Result<(), sqlx::Error> {
    let database_url = "mysql://campillo:mayo1500@192.168.1.151:3306/escandallos_db";
    let pool = MySqlPool::connect(database_url).await?;
    DB_POOL.set(pool).map_err(|_| sqlx::Error::RowNotFound)?;
    Ok(())
}

pub fn get_pool() -> &'static MySqlPool {
    DB_POOL.get().expect("Database pool not initialized")
}
