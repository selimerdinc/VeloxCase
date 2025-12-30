import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // <--- YENİ

function HistoryView({ historyData }) {
    const navigate = useNavigate(); // <--- Hook

    return (
        <div className="card" style={{animation: 'fadeIn 0.3s ease-out'}}>
            <div className="page-header">
                {/* navigate(-1) bir önceki sayfaya götürür veya ('/') ana sayfaya */}
                <button onClick={()=>navigate('/')} className="btn-back"><ArrowLeft size={20}/> Geri Dön</button>
                <div><h2>İşlem Geçmişi</h2><p>Son yapılan aktarımlar</p></div>
            </div>
            <div className="history-table-wrapper">
                <table className="history-table">
                    <thead>
                        <tr><th>Tarih</th><th>Görev Anahtarı</th><th>Oluşturulan Senaryo</th><th>Durum</th></tr>
                    </thead>
                    <tbody>
                        {historyData.map(log => (
                            <tr key={log.id}>
                                <td style={{color:'#64748b'}}>{log.date}</td>
                                <td style={{fontWeight:600}}>{log.task}</td>
                                <td>{log.case}</td>
                                <td><span className="status-badge-success">{log.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default HistoryView;